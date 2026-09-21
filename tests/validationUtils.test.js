const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// ValidationUtils reaches into DateUtils (future-date check) and, for currencies
// outside its own USD/GBP/EUR/INR table, into CurrencyService -> DataService.
// Load all four into one shared context so those cross-references are the real ones.
const { ValidationUtils, DateUtils } = loadInlineClasses(['DateUtils', 'CurrencyService', 'DataService', 'ValidationUtils']);

const validExpense = (overrides = {}) => ({
    amount: 12.5,
    date: '2020-01-15',
    categoryId: 1,
    subcategory: 'Groceries',
    paidBy: '',
    ...overrides,
});

const validIncome = (overrides = {}) => ({
    amount: 1000,
    date: '2020-01-15',
    source: 'Salary',
    ...overrides,
});

describe('validateExpense', () => {
    test('accepts a fully valid expense', () => {
        expect(ValidationUtils.validateExpense(validExpense())).toEqual({ isValid: true, errors: {} });
    });

    test.each([
        ['zero', 0],
        ['negative', -5],
        ['missing', undefined],
        ['empty string', ''],
        ['NaN', NaN],
    ])('rejects a %s amount', (_label, amount) => {
        const result = ValidationUtils.validateExpense(validExpense({ amount }));
        expect(result.isValid).toBe(false);
        expect(result.errors.amount).toBe('Amount must be greater than 0');
    });

    test('accepts a numeric-string amount, as form inputs supply', () => {
        expect(ValidationUtils.validateExpense(validExpense({ amount: '5' })).isValid).toBe(true);
        expect(ValidationUtils.validateExpense(validExpense({ amount: '-5' })).errors.amount).toBeDefined();
    });

    test('requires a date', () => {
        const result = ValidationUtils.validateExpense(validExpense({ date: '' }));
        expect(result.errors.date).toBe('Date is required');
    });

    test('rejects a future date but accepts today (local calendar day)', () => {
        const today = DateUtils.today();
        const tomorrow = DateUtils.addToDateStr(today, { days: 1 });
        expect(ValidationUtils.validateExpense(validExpense({ date: tomorrow })).errors.date).toBe('Date cannot be in the future');
        expect(ValidationUtils.validateExpense(validExpense({ date: today })).errors.date).toBeUndefined();
        expect(ValidationUtils.validateExpense(validExpense({ date: DateUtils.addToDateStr(today, { days: -1 }) })).errors.date).toBeUndefined();
    });

    test('requires category and subcategory', () => {
        const result = ValidationUtils.validateExpense(validExpense({ categoryId: '', subcategory: '' }));
        expect(result.errors.categoryId).toBe('Category is required');
        expect(result.errors.subcategory).toBe('Subcategory is required');
    });

    test.each([
        ['empty (own expense)', '', false],
        ['whitespace only (trims to empty)', '   ', false],
        ['undefined', undefined, false],
        ['one character', 'A', true],
        ['one character padded with spaces', ' A ', true],
        ['two characters', 'Al', false],
    ])('paidBy %s', (_label, paidBy, shouldError) => {
        const result = ValidationUtils.validateExpense(validExpense({ paidBy }));
        if (shouldError) expect(result.errors.paidBy).toBe('Name must be at least 2 characters if provided');
        else expect(result.errors.paidBy).toBeUndefined();
    });

    test('reports every failing field at once, not just the first', () => {
        const result = ValidationUtils.validateExpense({});
        expect(result.isValid).toBe(false);
        expect(Object.keys(result.errors).sort()).toEqual(['amount', 'categoryId', 'date', 'subcategory']);
    });
});

describe('validateIncome', () => {
    test('accepts a fully valid income', () => {
        expect(ValidationUtils.validateIncome(validIncome())).toEqual({ isValid: true, errors: {} });
    });

    test('rejects zero, negative and missing amounts', () => {
        [0, -1, undefined].forEach(amount => {
            expect(ValidationUtils.validateIncome(validIncome({ amount })).errors.amount).toBe('Amount must be greater than 0');
        });
    });

    test('requires a date', () => {
        expect(ValidationUtils.validateIncome(validIncome({ date: '' })).errors.date).toBe('Date is required');
    });

    test('requires a non-blank source', () => {
        ['', '   ', undefined].forEach(source => {
            expect(ValidationUtils.validateIncome(validIncome({ source })).errors.source).toBe('Income source is required');
        });
    });

    test('accepts a future date — unlike expenses, income has no future-date rule (see checked non-bugs)', () => {
        const future = DateUtils.addToDateStr(DateUtils.today(), { years: 1 });
        expect(ValidationUtils.validateIncome(validIncome({ date: future })).isValid).toBe(true);
    });
});

describe('validateCategory', () => {
    test('accepts a name of 2+ characters', () => {
        expect(ValidationUtils.validateCategory({ name: 'Food' })).toEqual({ isValid: true, errors: {} });
        expect(ValidationUtils.validateCategory({ name: 'Ab' }).isValid).toBe(true);
    });

    test.each([
        ['empty', '', 'Category name is required'],
        ['whitespace only', '   ', 'Category name is required'],
        ['missing', undefined, 'Category name is required'],
        ['a single character', 'A', 'Category name must be at least 2 characters'],
        ['a single character padded with spaces', ' A ', 'Category name must be at least 2 characters'],
    ])('rejects %s name', (_label, name, message) => {
        const result = ValidationUtils.validateCategory({ name });
        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBe(message);
    });
});

describe('formatCurrency', () => {
    test('formats the four built-in currencies with their own locale conventions', () => {
        expect(ValidationUtils.formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
        expect(ValidationUtils.formatCurrency(1234.5, 'GBP')).toBe('£1,234.50');
        expect(ValidationUtils.formatCurrency(1234.5, 'EUR')).toBe('€1,234.50');
        // en-IN groups in lakhs/crores, not thousands
        expect(ValidationUtils.formatCurrency(1234567.5, 'INR')).toBe('₹12,34,567.50');
    });

    test('defaults to USD when no currency is given', () => {
        expect(ValidationUtils.formatCurrency(5)).toBe('$5.00');
    });

    test('rounds to two decimals and handles zero and negatives', () => {
        expect(ValidationUtils.formatCurrency(0, 'GBP')).toBe('£0.00');
        expect(ValidationUtils.formatCurrency(0.005, 'USD')).toBe('$0.01');
        expect(ValidationUtils.formatCurrency(-12.345, 'GBP')).toBe('-£12.35');
    });

    test('falls back to CurrencyService symbol + toFixed(2) for a currency outside the built-in table', () => {
        // ZZZ is neither built in nor a saved custom currency, so the real
        // cross-reference into CurrencyService/DataService returns the bare code.
        expect(ValidationUtils.formatCurrency(12.5, 'ZZZ')).toBe('ZZZ12.50');
    });
});

describe('getCurrencySymbol', () => {
    test('returns the symbol for the four built-in currencies', () => {
        expect(ValidationUtils.getCurrencySymbol('USD')).toBe('$');
        expect(ValidationUtils.getCurrencySymbol('GBP')).toBe('£');
        expect(ValidationUtils.getCurrencySymbol('EUR')).toBe('€');
        expect(ValidationUtils.getCurrencySymbol('INR')).toBe('₹');
    });

    test('defaults to USD', () => {
        expect(ValidationUtils.getCurrencySymbol()).toBe('$');
    });

    test('delegates unknown codes to CurrencyService, which falls back to the code itself', () => {
        expect(ValidationUtils.getCurrencySymbol('ZZZ')).toBe('ZZZ');
    });
});

describe('getPasswordStrength', () => {
    test('empty password yields a blank, zero-percent result', () => {
        expect(ValidationUtils.getPasswordStrength('')).toEqual({ label: '', className: '', percent: 0 });
        expect(ValidationUtils.getPasswordStrength(undefined)).toEqual({ label: '', className: '', percent: 0 });
    });

    test.each([
        // score: +1 for len>=8, +1 for len>=12, +1 for >=2 char classes, +1 for >=3 char classes
        ['short single-class', 'abc', 'Weak', 33],
        ['8+ chars but single-class', 'abcdefgh', 'Weak', 33],
        ['short but two classes', 'abc123', 'Weak', 33],
        ['8+ chars, two classes', 'abcd1234', 'Fair', 66],
        ['8+ chars, three classes', 'Abcd1234', 'Fair', 66],
        ['12+ chars, two classes', 'abcdefgh1234', 'Fair', 66],
        ['12+ chars, three classes', 'Abcdefgh1234', 'Strong', 100],
        ['12+ chars, four classes', 'Abcdefg!1234', 'Strong', 100],
    ])('%s -> %s', (_label, password, label, percent) => {
        const result = ValidationUtils.getPasswordStrength(password);
        expect(result.label).toBe(label);
        expect(result.percent).toBe(percent);
        expect(result.className).toBe(label.toLowerCase());
    });
});

describe('formatDate', () => {
    test('formats an ISO timestamp as "Mon D, YYYY"', () => {
        // Midday UTC so the result is the same calendar day in every timezone.
        expect(ValidationUtils.formatDate('2026-03-15T12:00:00Z')).toBe('Mar 15, 2026');
    });

    // Stored transaction dates are date-only "YYYY-MM-DD" strings (see DateUtils).
    // new Date(str) parses those as UTC midnight, so in a negative-UTC-offset zone
    // (tests/helpers/globalSetup.js pins America/Los_Angeles) a naive
    // toLocaleDateString shows the PREVIOUS day. Regression guard for that.
    test('formats a stored date-only string as the SAME calendar day, in any timezone', () => {
        expect(ValidationUtils.formatDate('2026-01-05')).toBe('Jan 5, 2026');
        expect(ValidationUtils.formatDate('2026-12-31')).toBe('Dec 31, 2026');
        expect(ValidationUtils.formatDate('2026-03-01')).toBe('Mar 1, 2026');
    });

    test('still formats Date objects using local fields', () => {
        expect(ValidationUtils.formatDate(new Date(2026, 0, 5))).toBe('Jan 5, 2026');
    });
});
