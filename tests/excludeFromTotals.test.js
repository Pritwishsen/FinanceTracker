const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// "Exclude from Spend" / "Exclude from Income": the record still moves bank and cash
// balances, but is left out of every spending/income total.
const { countsInTotals, ValidationUtils, DataService, parseExcludedCell } = loadInlineClasses([
    'DateUtils', 'CurrencyService', 'DataService', 'ValidationUtils', 'matchesActiveView', 'countsInTotals', 'parseExcludedCell',
]);

const account = { id: 1, accountName: 'Main', accountType: 'Savings', currency: 'GBP', openingAmount: 100, person: 'own', isPrimary: true };

beforeEach(() => {
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
    DataService.isInitialized = true;
    DataService.saveBankAccounts([account]);
});

describe('countsInTotals', () => {
    test('normal and legacy records count', () => {
        expect(countsInTotals({ amount: 5 })).toBe(true);
        expect(countsInTotals({ amount: 5, excludeFromTotals: false })).toBe(true);
    });
    test('excluded records do not', () => {
        expect(countsInTotals({ amount: 5, excludeFromTotals: true })).toBe(false);
    });
});

describe('validateExpense with Exclude from Spend', () => {
    const base = { amount: 10, date: '2020-01-15', paidBy: '' };
    test('category is optional when excluded', () => {
        expect(ValidationUtils.validateExpense({ ...base, excludeFromTotals: true }).isValid).toBe(true);
    });
    test('a picked category still needs its subcategory', () => {
        const r = ValidationUtils.validateExpense({ ...base, excludeFromTotals: true, categoryId: 3 });
        expect(r.errors.subcategory).toBe('Subcategory is required');
    });
    test('category is still required for a normal expense', () => {
        expect(ValidationUtils.validateExpense(base).errors.categoryId).toBe('Category is required');
    });
});

describe('excluded records still move balances', () => {
    test('bank balance includes excluded expenses and income', () => {
        DataService.data.expenses = [{ id: 1, amount: 30, currency: 'GBP', accountId: 1, excludeFromTotals: true }];
        DataService.data.income = [{ id: 2, amount: 50, currency: 'GBP', accountId: 1, excludeFromTotals: true }];
        expect(DataService.computeBankAccountBalance(account)).toBe(120);
    });
    test('cash (unlinked) wallet includes excluded expenses and income', () => {
        DataService.data.expenses = [{ id: 1, amount: 20, currency: 'GBP', accountId: '', isCashPayment: true, excludeFromTotals: true }];
        DataService.data.income = [{ id: 2, amount: 200, currency: 'GBP', accountId: '', excludeFromTotals: true }];
        const parts = DataService.computeWalletParts(['own'], 'GBP');
        expect(parts.unlinkedExpenses).toBe(20);
        expect(parts.unlinkedIncome).toBe(200);
    });
});

describe('budgets ignore excluded spend', () => {
    test('getBudgetSummary only counts included expenses', async () => {
        const today = new Date();
        const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
        DataService.data.categories = [{ id: 7, name: 'Food', subcategories: ['Groceries'], personBudgets: { own: { budget: 100 } } }];
        DataService.data.expenses = [
            { id: 1, amount: 40, date, categoryId: 7, subcategory: 'Groceries', paidBy: '' },
            { id: 2, amount: 25, date, categoryId: 7, subcategory: 'Groceries', paidBy: '', excludeFromTotals: true },
        ];
        const summary = await DataService.getBudgetSummary(['own']);
        const food = summary.find(c => c.categoryId === 7 || c.id === 7 || c.name === 'Food');
        expect(food).toBeDefined();
        expect(food.spent).toBe(40);
    });
});

describe('Bulk Upload Excluded column', () => {
    test.each(['Yes', 'yes', 'TRUE', 'y', '1'])('%s means excluded', v => {
        expect(parseExcludedCell(v)).toEqual({ value: true });
    });
    test.each(['', '  ', 'No', 'false', 'n', '0', undefined])('%p means counted', v => {
        expect(parseExcludedCell(v)).toEqual({ value: false });
    });
    test('anything else is an error', () => {
        expect(parseExcludedCell('maybe')).toEqual({ error: true });
    });
});
