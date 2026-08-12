const { loadInlineClasses } = require('./helpers/loadInlineClasses');

test('extracted CurrencyService resolves its real cross-reference into DataService', () => {
    const { CurrencyService, DataService } = loadInlineClasses(['CurrencyService', 'DataService']);

    expect(DataService).toBeDefined();

    // Built-in currency: resolved from CurrencyService's own static table, no
    // cross-reference needed.
    expect(CurrencyService.getCurrencySymbol('GBP')).toBe('£');

    // Unsupported code: falls through to a REAL call into
    // DataService.getCustomCurrencies() (empty by default), then returns the
    // code unchanged. Exercises the actual runtime cross-reference that
    // CurrencyService/DataService share in the live file.
    expect(CurrencyService.getCurrencySymbol('ZZZ')).toBe('ZZZ');
});
