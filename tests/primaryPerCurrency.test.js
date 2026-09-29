const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// A person has at most one primary bank account per currency (e.g. a GBP and an INR
// primary side by side). These cover the rule itself and everything that looks a primary up.
const { DataService, resolveDefaultAccountId, computeLinkCandidates, __sandbox } = loadInlineClasses([
    'DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView', 'resolveDefaultAccountId', 'computeLinkCandidates',
]);

const store = __sandbox.localStorage;
const setAccounts = list => store.setItem('financeApp_bankAccounts', JSON.stringify(list));
const acct = (overrides = {}) => ({
    id: 1, accountName: 'Main', accountType: 'Current', currency: 'GBP',
    openingAmount: 0, person: 'own', isPrimary: false, ...overrides,
});
const primaries = () => DataService.getBankAccounts().filter(a => a.isPrimary).map(a => a.id).sort();

beforeEach(() => {
    store.clear();
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
    DataService.isInitialized = true;
});

describe('setting a primary account', () => {
    test('an INR primary does not replace the GBP primary', () => {
        setAccounts([acct({ id: 1, isPrimary: true }), acct({ id: 2 }), acct({ id: 3 }), acct({ id: 4, currency: 'INR' })]);
        DataService.updateBankAccount(4, { isPrimary: true });
        expect(primaries()).toEqual([1, 4]);
    });

    test('a second GBP primary replaces the first, and stamps updatedAt on the demoted one', () => {
        setAccounts([acct({ id: 1, isPrimary: true, updatedAt: '2020-01-01T00:00:00.000Z' }), acct({ id: 2 }), acct({ id: 4, currency: 'INR', isPrimary: true })]);
        DataService.updateBankAccount(2, { isPrimary: true });
        expect(primaries()).toEqual([2, 4]);
        expect(DataService.getBankAccounts().find(a => a.id === 1).updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
    });

    test('other people keep their own primary in the same currency', () => {
        setAccounts([acct({ id: 1, isPrimary: true, person: 'Madhu' }), acct({ id: 2 })]);
        DataService.updateBankAccount(2, { isPrimary: true });
        expect(primaries()).toEqual([1, 2]);
    });

    test('adding a new primary only clears the same owner + currency', () => {
        setAccounts([acct({ id: 1, isPrimary: true }), acct({ id: 2, currency: 'INR', isPrimary: true })]);
        const added = DataService.addBankAccount({ accountName: 'HDFC', accountType: 'Savings', currency: 'INR', person: 'own', openingAmount: 0, isPrimary: true });
        expect(primaries()).toEqual([1, added.id].sort());
    });

    test('moving a primary to a new owner clears that owner\'s primary in the same currency', () => {
        setAccounts([acct({ id: 1, isPrimary: true }), acct({ id: 2, isPrimary: true, person: 'Madhu' })]);
        DataService.updateBankAccount(1, { person: 'Madhu' });
        expect(primaries()).toEqual([1]);
    });
});

describe('looking a primary up', () => {
    beforeEach(() => setAccounts([acct({ id: 1, isPrimary: true }), acct({ id: 4, currency: 'INR', isPrimary: true }), acct({ id: 5, currency: 'USD' })]));

    test('getPrimaryAccountForPerson matches the currency', () => {
        expect(DataService.getPrimaryAccountForPerson('own', 'GBP').id).toBe(1);
        expect(DataService.getPrimaryAccountForPerson('own', 'INR').id).toBe(4);
        expect(DataService.getPrimaryAccountForPerson('own', 'USD')).toBeNull();
    });

    test('the Expense/Income default account follows the record currency', () => {
        expect(resolveDefaultAccountId('own', 'GBP')).toBe(1);
        expect(resolveDefaultAccountId('own', 'INR')).toBe(4);
        expect(resolveDefaultAccountId('own', 'USD')).toBe('');
    });
});

describe('linking unlinked records', () => {
    const expenses = [
        { id: 10, paidBy: '', currency: 'GBP', amount: 5 },
        { id: 11, paidBy: '', currency: 'INR', amount: 500 },
        { id: 12, paidBy: '', currency: 'INR', amount: 700 },
    ];
    const income = [{ id: 20, paidBy: '', currency: 'INR', amount: 1000 }];

    test('each primary gets its own candidate counts', () => {
        const accounts = [acct({ id: 1, isPrimary: true }), acct({ id: 4, currency: 'INR', isPrimary: true })];
        const c = computeLinkCandidates(accounts, expenses, income);
        expect(c.find(x => x.accountId === 1)).toMatchObject({ expenseCount: 1, incomeCount: 0 });
        expect(c.find(x => x.accountId === 4)).toMatchObject({ expenseCount: 2, incomeCount: 1 });
    });

    test('bulkLinkAccounts links only the chosen account\'s currency', async () => {
        setAccounts([acct({ id: 1, isPrimary: true }), acct({ id: 4, currency: 'INR', isPrimary: true })]);
        DataService.data.expenses = expenses.map(e => ({ ...e }));
        DataService.data.income = income.map(i => ({ ...i }));
        const n = await DataService.bulkLinkAccounts([4]);
        expect(n).toBe(3);
        expect(DataService.data.expenses.map(e => e.accountId)).toEqual([undefined, 4, 4]);
        expect(DataService.data.income[0].accountId).toBe(4);
    });
});
