const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Register #13: an added currency can only be deleted while nothing uses it.
const { DataService, __sandbox } = loadInlineClasses(['DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView']);
const store = __sandbox.localStorage;
const setKey = (key, value) => store.setItem('financeApp_' + key, JSON.stringify(value));

beforeEach(() => {
    store.clear();
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
});

test('unused currency counts 0', () => {
    DataService.data.expenses = [{ id: 1, currency: 'GBP' }];
    expect(DataService.countCurrencyUsage('JPY')).toBe(0);
});

test('counts every record type that carries a currency', () => {
    DataService.data.expenses = [{ id: 1, currency: 'JPY' }, { id: 2, currency: 'GBP' }];
    DataService.data.income = [{ id: 3, currency: 'JPY' }];
    setKey('bankAccounts', [{ id: 4, currency: 'JPY' }]);
    setKey('networth', [{ id: 5, currency: 'JPY', type: 'asset' }, { id: 6, currency: 'JPY', type: 'liability' }]);
    setKey('goals', [{ id: 7, currency: 'JPY' }]);
    setKey('bills', [{ id: 8, currency: 'JPY' }]);
    setKey('debts', [{ id: 9, currency: 'JPY' }]);
    setKey('recurring', [{ id: 10, templateExpense: { currency: 'JPY' } }, { id: 11, templateExpense: { currency: 'GBP' } }]);
    expect(DataService.countCurrencyUsage('JPY')).toBe(9);
    expect(DataService.countCurrencyUsage('GBP')).toBe(2);
});

test('counting never changes stored data', () => {
    setKey('goals', [{ id: 7, currency: 'JPY' }]);
    const before = JSON.stringify(store);
    DataService.countCurrencyUsage('JPY');
    expect(JSON.stringify(store)).toBe(before);
});
