const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Asset Growth shows market movement: growth = (end − start) − money added in the period.
const { DataService, spAssetValueAt, spGrowthCalc, __sandbox } = loadInlineClasses([
    'DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView', 'computeNextDue',
    'spWithFundingTopups', 'spAssetValueBefore', 'spAssetValueAt', 'spAssetOpening', 'spGrowthCalc'
]);
const store = __sandbox.localStorage;
const Q = (from, to) => ({ from, to });
const id = (x) => x;

beforeEach(() => {
    store.clear();
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
});

const base = (history, extra = {}) => ({ id: 1, type: 'asset', name: 'Fund', currency: 'GBP', openDate: '2025-01-01', history, ...extra });

test('a quarter with only a top-up shows no growth', () => {
    const a = base([{ type: 'topup', amount: 500, date: '2025-05-01' }], { value: 1500 });
    const c = spGrowthCalc([a], Q('2025-04-01', '2025-06-30'), id);
    expect(c.added).toBe(500);
    expect(c.growth).toBe(0);
});

test('a quarter with only a valuation shows the change as growth', () => {
    const a = base([{ type: 'value', from: 1000, value: 1080, date: '2025-05-01' }], { value: 1080 });
    const c = spGrowthCalc([a], Q('2025-04-01', '2025-06-30'), id);
    expect(c.growth).toBe(80);
    expect(c.rows[0]).toEqual(expect.objectContaining({ growth: 80, chg: 80 }));
});

test('a top-up and a valuation in one quarter are split correctly', () => {
    const a = base([
        { type: 'topup', amount: 500, date: '2025-04-10' },
        { type: 'value', from: 1500, value: 1450, date: '2025-06-20' }
    ], { value: 1450 });
    const c = spGrowthCalc([a], Q('2025-04-01', '2025-06-30'), id);
    expect(c.chg).toBe(450);
    expect(c.added).toBe(500);
    expect(c.growth).toBe(-50);
    expect(c.rows[0].growth).toBe(-50);
});

test('opening an asset in the period is money added, not growth', () => {
    const a = base([{ type: 'value', from: 1000, value: 1100, date: '2025-03-01' }], { value: 1100, openDate: '2025-02-01' });
    const c = spGrowthCalc([a], Q('2025-01-01', '2025-03-31'), id);
    expect(c.start).toBe(0);
    expect(c.added).toBe(1000);
    expect(c.growth).toBe(100);
});

test('a back-dated valuation slots in without changing the current value', () => {
    const a = DataService.addNetWorthItem({ name: 'ISA', value: 1000, currency: 'GBP', categoryId: 1, type: 'asset', person: 'own', openDate: '2025-01-01' });
    DataService.recordNetWorthValuation(a.id, 1300, '2025-09-01');
    DataService.recordNetWorthValuation(a.id, 1100, '2025-05-01'); // backfilled later
    const it = DataService.getNetWorthItems().find(i => i.id === a.id);
    expect(it.value).toBe(1300);
    expect(it.valuedOn).toBe('2025-09-01');
    expect(it.history[1]).toEqual(expect.objectContaining({ from: 1000, value: 1100, date: '2025-05-01' }));
    expect(spAssetValueAt(it, '2025-04-30')).toBe(1000);
    expect(spAssetValueAt(it, '2025-05-01')).toBe(1100);
    expect(spAssetValueAt(it, '2025-08-31')).toBe(1100);
    expect(spAssetValueAt(it, '2025-09-01')).toBe(1300);
    expect(spGrowthCalc([it], Q('2025-04-01', '2025-06-30'), id).growth).toBe(100);
    expect(spGrowthCalc([it], Q('2025-07-01', '2025-09-30'), id).growth).toBe(200);
});

test('a back-dated valuation keeps later top-ups on top', () => {
    const a = DataService.addNetWorthItem({ name: 'ISA', value: 1000, currency: 'GBP', categoryId: 1, type: 'asset', person: 'own', openDate: '2025-01-01' });
    DataService._applyNetWorthIncrement({ netWorthItemId: a.id, amount: 200 }, '2025-07-01');
    DataService.recordNetWorthValuation(a.id, 1050, '2025-05-01');
    const it = DataService.getNetWorthItems().find(i => i.id === a.id);
    expect(it.value).toBe(1250);
    expect(spAssetValueAt(it, '2025-06-30')).toBe(1050);
    expect(spAssetValueAt(it, '2025-07-01')).toBe(1250);
});
