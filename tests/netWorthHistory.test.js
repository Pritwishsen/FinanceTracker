const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Phase 8 approved changes: per-item history (top-ups, valuations, liability balances),
// top-up date, openDate, and deleting an item also deleting its repeat schedule.
const { DataService, DateUtils, __sandbox } = loadInlineClasses(['DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView', 'computeNextDue']);
const store = __sandbox.localStorage;

beforeEach(() => {
    store.clear();
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
});

const asset = (extra = {}) => DataService.addNetWorthItem({ name: 'ISA', value: 1000, currency: 'GBP', categoryId: 1, type: 'asset', person: 'own', ...extra });
const getItem = (id) => DataService.getNetWorthItems().find(i => i.id === id);

test('new items keep openDate when given, and old-style items have none', () => {
    expect(asset({ openDate: '2024-03-01' }).openDate).toBe('2024-03-01');
    expect(asset().openDate).toBeUndefined();
});

test('a top-up raises invested and value, records a dated history entry and dates the funding transfer', () => {
    store.setItem('financeApp_bankAccounts', JSON.stringify([{ id: 7, accountName: 'Main', accountType: 'Checking', currency: 'GBP', person: 'own', openingAmount: 5000 }]));
    const a = asset();
    DataService._applyNetWorthIncrement({ netWorthItemId: a.id, amount: 250, accountId: 7 }, '2026-09-01', { notes: 'Investment funding — logged for audit' });
    const it = getItem(a.id);
    expect(it.value).toBe(1250);
    expect(it.originalAmount).toBe(1250);
    expect(it.history).toEqual([expect.objectContaining({ type: 'topup', amount: 250, date: '2026-09-01' })]);
    const t = DataService.getTransfers()[0];
    expect(t).toEqual(expect.objectContaining({ fromAccountId: 7, fromAmount: 250, toAssetId: a.id, date: '2026-09-01', notes: 'Investment funding — logged for audit' }));
});

test('a top-up without an account logs no transfer', () => {
    const a = asset();
    DataService._applyNetWorthIncrement({ netWorthItemId: a.id, amount: 100, accountId: '' }, '2026-09-02');
    expect(getItem(a.id).value).toBe(1100);
    expect(DataService.getTransfers()).toHaveLength(0);
});

test('valuations record from/value/date and set valuedOn; invested is untouched', () => {
    const a = asset();
    DataService.recordNetWorthValuation(a.id, 1180, '2026-09-10');
    const it = getItem(a.id);
    expect(it.value).toBe(1180);
    expect(it.originalAmount).toBe(1000);
    expect(it.valuedOn).toBe('2026-09-10');
    expect(it.history).toEqual([expect.objectContaining({ type: 'value', from: 1000, value: 1180, date: '2026-09-10' })]);
});

test('liability balance updates are recorded as balance entries', () => {
    const l = DataService.addNetWorthItem({ name: 'Car loan', value: 8000, currency: 'GBP', categoryId: 2, type: 'liability', person: 'own' });
    DataService.recordNetWorthValuation(l.id, 7400, '2026-09-15');
    const it = getItem(l.id);
    expect(it.value).toBe(7400);
    expect(it.originalAmount).toBe(8000); // "Originally borrowed"
    expect(it.history[0]).toEqual(expect.objectContaining({ type: 'balance', from: 8000, value: 7400 }));
});

test('deleting an item removes its repeat schedule but leaves other schedules', () => {
    const a = asset();
    const b = asset({ name: 'Pension' });
    DataService.addRecurring({ templateExpense: { netWorthItemId: a.id, netWorthItemName: 'ISA', amount: 100, currency: 'GBP', accountId: '', person: 'own' }, frequency: 'monthly', endDate: '', type: 'asset' });
    DataService.addRecurring({ templateExpense: { netWorthItemId: b.id, netWorthItemName: 'Pension', amount: 50, currency: 'GBP', accountId: '', person: 'own' }, frequency: 'monthly', endDate: '', type: 'asset' });
    DataService.addRecurring({ templateExpense: { description: 'Gym', amount: 30, currency: 'GBP' }, frequency: 'monthly', endDate: '', type: 'expense' });
    DataService.deleteNetWorthItem(a.id);
    const left = DataService.getRecurring();
    expect(left).toHaveLength(2);
    expect(left.some(r => r.templateExpense.netWorthItemId === a.id)).toBe(false);
});

test('computeWalletParts adds up to computeWallet', () => {
    DataService.data.income = [{ amount: 300, currency: 'GBP', paidBy: '' }];
    DataService.data.expenses = [{ amount: 120, currency: 'GBP', paidBy: '' }];
    const p = DataService.computeWalletParts(['own'], 'GBP');
    expect(p.unlinkedIncome).toBe(300);
    expect(p.unlinkedExpenses).toBe(120);
    expect(DataService.computeWallet(['own'], 'GBP')).toBe(p.unlinkedIncome - p.unlinkedExpenses + p.primaryBalances);
});

test('a top-up paid from cash in hand writes a negative cash correction, not a transfer or expense', () => {
    const a = asset();
    // Start with £100 cash via an existing cash correction.
    DataService.addReconciliation({ accountId: 'cash-own|GBP', person: 'own', date: '2026-09-01', balanceBefore: 0, delta: 100, balanceAfter: 100, notes: '', loggedAsTransaction: false });
    DataService._applyNetWorthIncrement({ netWorthItemId: a.id, amount: 40, accountId: 'cash-own|GBP' }, '2026-09-05');
    expect(getItem(a.id).value).toBe(1040);
    expect(DataService.getTransfers()).toHaveLength(0);
    expect(DataService.data.expenses).toHaveLength(0);
    const last = DataService.getReconciliations().slice(-1)[0];
    expect(last).toEqual(expect.objectContaining({ accountId: 'cash-own|GBP', delta: -40, balanceBefore: 100, balanceAfter: 60, loggedAsTransaction: false, date: '2026-09-05', notes: 'Asset funding: ISA' }));
    const cash = DataService.getCashWithdrawItems(null).find(i => i.person === 'own' && i.currency === 'GBP');
    expect(cash.value).toBe(60);
});

test('a scheduled top-up paid from cash deducts cash each time it runs', async () => {
    const a = asset();
    DataService.addReconciliation({ accountId: 'cash-own|GBP', person: 'own', date: '2026-01-01', balanceBefore: 0, delta: 500, balanceAfter: 500, notes: '', loggedAsTransaction: false });
    DataService.addRecurring({ templateExpense: { netWorthItemId: a.id, netWorthItemName: 'ISA', amount: 25, currency: 'GBP', accountId: 'cash-own|GBP', person: 'own' }, frequency: 'monthly', endDate: '', type: 'asset', startDate: '2000-01-01' });
    // Force exactly two due runs.
    const r = DataService.getRecurring(); r[0].nextDue = DateUtils.addToDateStr(DateUtils.today(), { months: -1 }); DataService.saveRecurring(r);
    await DataService.processRecurringSchedules();
    expect(getItem(a.id).value).toBe(1050);
    const cash = DataService.getCashWithdrawItems(null).find(i => i.person === 'own' && i.currency === 'GBP');
    expect(cash.value).toBe(450);
});

test('deleting an Asset Funding entry takes the amount back off the asset (approved)', () => {
    store.setItem('financeApp_bankAccounts', JSON.stringify([{ id: 7, accountName: 'Main', accountType: 'Checking', currency: 'GBP', person: 'own', openingAmount: 5000 }]));
    const a = asset();
    DataService._applyNetWorthIncrement({ netWorthItemId: a.id, amount: 200, accountId: 7 }, '2026-09-03', { notes: 'Investment funding — logged for audit' });
    const t = DataService.getTransfers()[0];
    DataService.deleteTransfer(t.id);
    DataService.revertAssetFunding(t);
    const it = getItem(a.id);
    expect(it.value).toBe(1000);
    expect(it.originalAmount).toBe(1000);
    expect(it.history).toEqual([]);
    expect(DataService.getTransfers()).toHaveLength(0);
});

test('reverting ignores cash withdrawals and unknown assets', () => {
    const a = asset();
    DataService.revertAssetFunding({ toAssetId: 'cash-own-GBP', isCashWithdrawal: true, toAmount: 50 });
    DataService.revertAssetFunding({ toAssetId: 999999, toAmount: 50 });
    expect(getItem(a.id).value).toBe(1000);
});
