const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// CurrencyService / DataService call into each other, and DataService's wallet and
// bank-scoping code calls the top-level matchesActiveView helper — load all of them
// into one shared context so every cross-reference is the real one.
const { CurrencyService, DataService, __sandbox } = loadInlineClasses([
    'DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView',
]);

// Built-in fallback rates the sync conversion paths use (kept literal here so a
// change to the table is a deliberate, visible test update):
//   GBP->USD 1.27, USD->GBP 0.79, EUR->GBP 0.85, GBP->INR 106.5, INR->GBP 0.0094

const store = __sandbox.localStorage;
const setKey = (key, value) => store.setItem('financeApp_' + key, JSON.stringify(value));

const bankAccount = (overrides = {}) => ({
    id: 1, accountName: 'Main', accountType: 'Savings', currency: 'GBP',
    openingAmount: 0, person: 'own', isPrimary: false, ...overrides,
});

beforeEach(() => {
    store.clear();
    // Reset the static in-memory state both services keep between calls.
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
    CurrencyService.ratesCache = {};
    delete __sandbox.fetch;
});

const setCustomCurrencies = list => { DataService.data.settings.customCurrencies = list; };

// ─────────────────────────────────────────────────────────────────────────────
describe('CurrencyService.convertToDefaultSync', () => {
    test('same currency is returned untouched, even for a code nothing knows about', () => {
        expect(CurrencyService.convertToDefaultSync(123.45, 'GBP', 'GBP')).toBe(123.45);
        expect(CurrencyService.convertToDefaultSync(9, 'ZZZ', 'ZZZ')).toBe(9);
    });

    test.each([
        ['GBP', 'USD', 100, 127],
        ['USD', 'GBP', 100, 79],
        ['EUR', 'GBP', 100, 85],
        ['GBP', 'INR', 100, 10650],
        ['INR', 'GBP', 1000, 9.4],
    ])('built-in fallback rate %s -> %s', (from, to, amount, expected) => {
        expect(CurrencyService.convertToDefaultSync(amount, from, to)).toBeCloseTo(expected, 6);
    });

    test('is not rounded — full precision is kept for callers that sum many records', () => {
        expect(CurrencyService.convertToDefaultSync(1234.56, 'INR', 'GBP')).toBeCloseTo(11.604864, 6);
    });

    test('an unknown pair with no rate anywhere falls back to the unconverted amount', () => {
        expect(CurrencyService.convertToDefaultSync(50, 'ZZZ', 'GBP')).toBe(50);
        expect(CurrencyService.convertToDefaultSync(50, 'GBP', 'ZZZ')).toBe(50);
    });

    describe('custom currencies (added via Settings, rate stored against another currency)', () => {
        beforeEach(() => setCustomCurrencies([{ code: 'XYZ', name: 'Test', rate: 2, rateAgainst: 'GBP' }]));

        test('custom -> the currency it is rated against multiplies by rate', () => {
            expect(CurrencyService.convertToDefaultSync(10, 'XYZ', 'GBP')).toBe(20);
        });

        test('the currency it is rated against -> custom divides by rate', () => {
            expect(CurrencyService.convertToDefaultSync(10, 'GBP', 'XYZ')).toBe(5);
        });

        test('a pair that does not involve the custom currency\'s rateAgainst is NOT triangulated', () => {
            // XYZ is rated against GBP only; there is no XYZ->USD path, so the amount
            // comes back unconverted. Guards against a "fix" that silently invents rates.
            expect(CurrencyService.convertToDefaultSync(10, 'XYZ', 'USD')).toBe(10);
            expect(CurrencyService.convertToDefaultSync(10, 'USD', 'XYZ')).toBe(10);
        });

        test('built-in fallback rates take precedence over custom lookups', () => {
            setCustomCurrencies([{ code: 'GBP', name: 'Shadow', rate: 999, rateAgainst: 'USD' }]);
            expect(CurrencyService.convertToDefaultSync(100, 'GBP', 'USD')).toBeCloseTo(127, 6);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('CurrencyService.convertCurrency (async, rounded to 2dp)', () => {
    let warn, error;
    beforeEach(() => {
        // fetchExchangeRates deliberately logs on failure; keep test output clean.
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
        error = jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => { warn.mockRestore(); error.mockRestore(); });

    const liveRates = rates => jest.fn(async () => ({ ok: true, json: async () => ({ rates }) }));

    test('same currency short-circuits without touching the network', async () => {
        __sandbox.fetch = jest.fn();
        expect(await CurrencyService.convertCurrency(42.5, 'GBP', 'GBP')).toBe(42.5);
        expect(__sandbox.fetch).not.toHaveBeenCalled();
    });

    test('uses live rates when the API responds, and rounds to 2 decimals', async () => {
        __sandbox.fetch = liveRates({ USD: 1.3333 });
        expect(await CurrencyService.convertCurrency(100, 'GBP', 'USD')).toBe(133.33);
        expect(__sandbox.fetch).toHaveBeenCalledWith('https://api.exchangerate-api.com/v4/latest/GBP');
    });

    test('caches live rates per base currency (one fetch for repeated conversions)', async () => {
        __sandbox.fetch = liveRates({ USD: 1.5, EUR: 1.2 });
        await CurrencyService.convertCurrency(10, 'GBP', 'USD');
        await CurrencyService.convertCurrency(20, 'GBP', 'EUR');
        expect(__sandbox.fetch).toHaveBeenCalledTimes(1);
    });

    test('a network failure falls back to the built-in table', async () => {
        __sandbox.fetch = jest.fn(async () => { throw new Error('offline'); });
        expect(await CurrencyService.convertCurrency(100, 'GBP', 'USD')).toBe(127);
        // rounding applies to the fallback path too: 1234.56 * 0.0094 = 11.6049...
        expect(await CurrencyService.convertCurrency(1234.56, 'INR', 'GBP')).toBe(11.6);
    });

    test('a non-OK API response also falls back to the built-in table', async () => {
        __sandbox.fetch = jest.fn(async () => ({ ok: false }));
        expect(await CurrencyService.convertCurrency(100, 'USD', 'GBP')).toBe(79);
    });

    test('when live rates lack the target currency, the built-in table fills the gap', async () => {
        __sandbox.fetch = liveRates({ EUR: 1.2 });
        expect(await CurrencyService.convertCurrency(100, 'GBP', 'USD')).toBe(127);
    });

    test('recently cached rates (<24h) are used when the network is down', async () => {
        store.setItem('exchangeRates_GBP', JSON.stringify({ rates: { USD: 2 }, timestamp: Date.now() - 60 * 60 * 1000 }));
        __sandbox.fetch = jest.fn(async () => { throw new Error('offline'); });
        expect(await CurrencyService.convertCurrency(10, 'GBP', 'USD')).toBe(20);
    });

    test('stale cached rates (>24h) are ignored in favour of the built-in table', async () => {
        store.setItem('exchangeRates_GBP', JSON.stringify({ rates: { USD: 2 }, timestamp: Date.now() - 25 * 60 * 60 * 1000 }));
        __sandbox.fetch = jest.fn(async () => { throw new Error('offline'); });
        expect(await CurrencyService.convertCurrency(10, 'GBP', 'USD')).toBe(12.7);
    });

    describe('custom currencies bypass the live API entirely', () => {
        beforeEach(() => {
            setCustomCurrencies([{ code: 'XYZ', name: 'Test', rate: 1.2345, rateAgainst: 'GBP' }]);
            __sandbox.fetch = jest.fn();
        });

        test('custom -> rateAgainst multiplies by the stored rate, rounded to 2dp', async () => {
            expect(await CurrencyService.convertCurrency(10, 'XYZ', 'GBP')).toBe(12.35);
            expect(__sandbox.fetch).not.toHaveBeenCalled();
        });

        test('rateAgainst -> custom divides by the stored rate, rounded to 2dp', async () => {
            expect(await CurrencyService.convertCurrency(10, 'GBP', 'XYZ')).toBe(8.1);
            expect(__sandbox.fetch).not.toHaveBeenCalled();
        });

        test('a custom pair with no stored path returns the amount unchanged', async () => {
            expect(await CurrencyService.convertCurrency(10, 'XYZ', 'USD')).toBe(10);
            expect(__sandbox.fetch).not.toHaveBeenCalled();
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DataService.computeBankAccountBalance', () => {
    const balance = (account, { income = [], expenses = [], transfers = [], reconciliations = [] } = {}) => {
        DataService.data.income = income;
        DataService.data.expenses = expenses;
        setKey('transfers', transfers);
        setKey('reconciliations', reconciliations);
        return DataService.computeBankAccountBalance(account);
    };

    test('a fresh account is just its opening amount (numeric or string)', () => {
        expect(balance(bankAccount({ openingAmount: 250 }))).toBe(250);
        expect(balance(bankAccount({ openingAmount: '100.50' }))).toBe(100.5);
        expect(balance(bankAccount({ openingAmount: undefined }))).toBe(0);
        expect(balance(bankAccount({ openingAmount: 'garbage' }))).toBe(0);
    });

    test('asset accounts: opening + linked income - linked expenses', () => {
        const result = balance(bankAccount({ openingAmount: 1000 }), {
            income: [{ accountId: 1, amount: 500, currency: 'GBP' }],
            expenses: [{ accountId: 1, amount: 120, currency: 'GBP' }, { accountId: 1, amount: 30, currency: 'GBP' }],
        });
        expect(result).toBe(1350);
    });

    test.each(['Credit Card', 'Loan'])('%s accounts reverse the sign: charges raise what is owed, payments lower it', accountType => {
        const result = balance(bankAccount({ accountType, openingAmount: 200 }), {
            income: [{ accountId: 1, amount: 50, currency: 'GBP' }],      // a payment
            expenses: [{ accountId: 1, amount: 80, currency: 'GBP' }],    // a charge
        });
        expect(result).toBe(200 + 80 - 50);
    });

    test('records linked to other accounts, or to no account, are ignored', () => {
        const result = balance(bankAccount({ id: 1, openingAmount: 100 }), {
            income: [{ accountId: 2, amount: 999, currency: 'GBP' }, { amount: 999, currency: 'GBP' }],
            expenses: [{ accountId: 2, amount: 999, currency: 'GBP' }, { accountId: null, amount: 999, currency: 'GBP' }],
        });
        expect(result).toBe(100);
    });

    describe('string vs number accountId (DEF-034 regression guard)', () => {
        test('numeric account id matches string accountId on a record', () => {
            const result = balance(bankAccount({ id: 12345, openingAmount: 100 }), {
                income: [{ accountId: '12345', amount: 50, currency: 'GBP' }],
                expenses: [{ accountId: '12345', amount: 20, currency: 'GBP' }],
            });
            expect(result).toBe(130);
        });

        test('string account id matches numeric accountId on a record', () => {
            const result = balance(bankAccount({ id: '12345', openingAmount: 100 }), {
                income: [{ accountId: 12345, amount: 50, currency: 'GBP' }],
                expenses: [{ accountId: 12345, amount: 20, currency: 'GBP' }],
            });
            expect(result).toBe(130);
        });

        test('transfers and reconciliations match across the string/number boundary too', () => {
            const result = balance(bankAccount({ id: 7, openingAmount: 100 }), {
                transfers: [{ fromAccountId: '7', fromAmount: 30, toAccountId: '9', toAmount: 30 }, { fromAccountId: 9, fromAmount: 5, toAccountId: '7', toAmount: 5 }],
                reconciliations: [{ accountId: '7', delta: 2, loggedAsTransaction: false }],
            });
            expect(result).toBe(100 - 30 + 5 + 2);
        });
    });

    describe('cross-currency linked records are converted into the account\'s own currency', () => {
        test('GBP account, USD expense: 100 USD = 79 GBP deducted', () => {
            const result = balance(bankAccount({ currency: 'GBP', openingAmount: 1000 }), {
                expenses: [{ accountId: 1, amount: 100, currency: 'USD' }],
            });
            expect(result).toBeCloseTo(921, 6);
        });

        test('USD account, GBP income: 100 GBP = 127 USD added', () => {
            const result = balance(bankAccount({ currency: 'USD', openingAmount: 0 }), {
                income: [{ accountId: 1, amount: 100, currency: 'GBP' }],
            });
            expect(result).toBeCloseTo(127, 6);
        });

        test('a record with no currency is treated as GBP', () => {
            const result = balance(bankAccount({ currency: 'USD', openingAmount: 0 }), {
                income: [{ accountId: 1, amount: 100 }],
            });
            expect(result).toBeCloseTo(127, 6);
        });

        test('same-currency records are never converted', () => {
            const result = balance(bankAccount({ currency: 'INR', openingAmount: 0 }), {
                income: [{ accountId: 1, amount: 12345.67, currency: 'INR' }],
            });
            expect(result).toBe(12345.67);
        });

        // Regression guard: the balance once converted with the built-in rate table only, so a
        // custom-currency record manually linked (the Account picker isn't currency-filtered)
        // to an account in another currency was silently counted 1:1.
        describe('custom currencies (XYZ: 1 XYZ = 2 GBP)', () => {
            beforeEach(() => setCustomCurrencies([{ code: 'XYZ', name: 'Test', rate: 2, rateAgainst: 'GBP' }]));

            test('custom-currency income on a GBP account is converted at the stored rate', () => {
                const result = balance(bankAccount({ currency: 'GBP', openingAmount: 100 }), {
                    income: [{ accountId: 1, amount: 10, currency: 'XYZ' }],
                });
                expect(result).toBe(120);
            });

            test('custom-currency expense on a GBP account is converted at the stored rate', () => {
                const result = balance(bankAccount({ currency: 'GBP', openingAmount: 100 }), {
                    expenses: [{ accountId: 1, amount: 10, currency: 'XYZ' }],
                });
                expect(result).toBe(80);
            });

            test('GBP income on an account held in the custom currency divides by the rate', () => {
                const result = balance(bankAccount({ currency: 'XYZ', openingAmount: 0 }), {
                    income: [{ accountId: 1, amount: 10, currency: 'GBP' }],
                });
                expect(result).toBe(5);
            });

            test('a liability account in the custom currency converts charges too', () => {
                const result = balance(bankAccount({ currency: 'XYZ', accountType: 'Credit Card', openingAmount: 0 }), {
                    expenses: [{ accountId: 1, amount: 10, currency: 'GBP' }],
                });
                expect(result).toBe(5);
            });

            test('records already in the custom currency are not converted', () => {
                const result = balance(bankAccount({ currency: 'XYZ', openingAmount: 0 }), {
                    income: [{ accountId: 1, amount: 10, currency: 'XYZ' }],
                });
                expect(result).toBe(10);
            });

            test('a pair with no known rate (custom vs an unrelated currency) stays unconverted, as before', () => {
                // XYZ is only rated against GBP — no XYZ<->USD path exists anywhere in the app.
                const result = balance(bankAccount({ currency: 'USD', openingAmount: 0 }), {
                    income: [{ accountId: 1, amount: 10, currency: 'XYZ' }],
                });
                expect(result).toBe(10);
            });

            test('the custom conversion flows through to the Wallet via the primary account', () => {
                DataService.data.income = [{ accountId: 1, amount: 10, currency: 'XYZ' }];
                DataService.data.expenses = [];
                setKey('bankAccounts', [bankAccount({ id: 1, isPrimary: true, currency: 'GBP', openingAmount: 100 })]);
                setKey('transfers', []);
                setKey('reconciliations', []);
                expect(DataService.computeWallet(undefined, 'GBP')).toBe(120);
            });
        });
    });

    describe('transfers use the stored per-account amounts with no re-conversion', () => {
        test('asset account: out reduces, in increases', () => {
            const result = balance(bankAccount({ id: 1, openingAmount: 500 }), {
                transfers: [
                    { fromAccountId: 1, fromAmount: 100, toAccountId: 2, toAmount: 127 },
                    { fromAccountId: 3, fromAmount: 40, toAccountId: 1, toAmount: 40 },
                ],
            });
            expect(result).toBe(500 - 100 + 40);
        });

        test('the receiving side uses toAmount (its own currency), not fromAmount', () => {
            const result = balance(bankAccount({ id: 2, currency: 'USD', openingAmount: 0 }), {
                transfers: [{ fromAccountId: 1, fromAmount: 100, toAccountId: 2, toAmount: 127 }],
            });
            expect(result).toBe(127);
        });

        test('liability account: transfers out raise the balance owed, transfers in lower it', () => {
            const result = balance(bankAccount({ id: 1, accountType: 'Credit Card', openingAmount: 300 }), {
                transfers: [
                    { fromAccountId: 1, fromAmount: 50, toAccountId: null, toAmount: 0 },
                    { fromAccountId: 2, fromAmount: 120, toAccountId: 1, toAmount: 120 },
                ],
            });
            expect(result).toBe(300 + 50 - 120);
        });

        test('a phantom transfer to an asset (toAccountId null) still deducts from the source', () => {
            const result = balance(bankAccount({ id: 1, openingAmount: 500 }), {
                transfers: [{ fromAccountId: 1, fromAmount: 75, toAccountId: null, toAssetId: 'x', toAmount: 0 }],
            });
            expect(result).toBe(425);
        });
    });

    describe('reconciliations', () => {
        test('an unlogged reconciliation delta is folded into the balance', () => {
            const result = balance(bankAccount({ openingAmount: 100 }), {
                reconciliations: [{ accountId: 1, delta: -12.5, loggedAsTransaction: false }],
            });
            expect(result).toBe(87.5);
        });

        test('a logged one is excluded — its real Expense/Income record already moved the balance', () => {
            const result = balance(bankAccount({ openingAmount: 100 }), {
                reconciliations: [{ accountId: 1, delta: -12.5, loggedAsTransaction: true }],
            });
            expect(result).toBe(100);
        });

        test('other accounts\' reconciliations are ignored, sequential ones sum', () => {
            const result = balance(bankAccount({ id: 1, openingAmount: 100 }), {
                reconciliations: [
                    { accountId: 1, delta: 10, loggedAsTransaction: false },
                    { accountId: 1, delta: -4, loggedAsTransaction: false },
                    { accountId: 2, delta: 999, loggedAsTransaction: false },
                ],
            });
            expect(result).toBe(106);
        });

        test('applies the same way to liability accounts (delta is a raw balance correction)', () => {
            const result = balance(bankAccount({ accountType: 'Loan', openingAmount: 1000 }), {
                reconciliations: [{ accountId: 1, delta: -25, loggedAsTransaction: false }],
            });
            expect(result).toBe(975);
        });
    });

    test('everything together', () => {
        const result = balance(bankAccount({ id: 1, currency: 'GBP', openingAmount: 1000 }), {
            income: [{ accountId: 1, amount: 200, currency: 'GBP' }, { accountId: '1', amount: 100, currency: 'USD' }],
            expenses: [{ accountId: 1, amount: 50, currency: 'GBP' }],
            transfers: [{ fromAccountId: 1, fromAmount: 300, toAccountId: 2, toAmount: 300 }, { fromAccountId: 2, fromAmount: 10, toAccountId: 1, toAmount: 10 }],
            reconciliations: [{ accountId: 1, delta: 3, loggedAsTransaction: false }, { accountId: 1, delta: 500, loggedAsTransaction: true }],
        });
        // 1000 + 200 + (100 USD -> 79) - 50 - 300 + 10 + 3
        expect(result).toBeCloseTo(942, 6);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DataService.computeWallet', () => {
    const wallet = ({ income = [], expenses = [], accounts = [], transfers = [] }, activeView, defaultCurrency = 'GBP') => {
        DataService.data.income = income;
        DataService.data.expenses = expenses;
        setKey('bankAccounts', accounts);
        setKey('transfers', transfers);
        setKey('reconciliations', []);
        return DataService.computeWallet(activeView, defaultCurrency);
    };

    test('with no data the wallet is zero', () => {
        expect(wallet({})).toBe(0);
    });

    test('unlinked income minus unlinked expenses', () => {
        expect(wallet({
            income: [{ amount: 500, currency: 'GBP' }],
            expenses: [{ amount: 120, currency: 'GBP' }, { amount: 30, currency: 'GBP' }],
        })).toBe(350);
    });

    test('can go negative', () => {
        expect(wallet({ expenses: [{ amount: 40, currency: 'GBP' }] })).toBe(-40);
    });

    test('linked records are NOT counted as loose cash (they live in the account balance)', () => {
        expect(wallet({
            income: [{ amount: 500, currency: 'GBP', accountId: 9 }],
            expenses: [{ amount: 120, currency: 'GBP', accountId: 9 }],
        })).toBe(0);
    });

    test('a primary asset account\'s balance is added; non-primary accounts are not', () => {
        expect(wallet({
            accounts: [
                bankAccount({ id: 1, isPrimary: true, openingAmount: 1000 }),
                bankAccount({ id: 2, isPrimary: false, openingAmount: 5000 }),
            ],
        })).toBe(1000);
    });

    test('a primary Credit Card/Loan is never spending money — it stays a pure liability', () => {
        expect(wallet({
            accounts: [
                bankAccount({ id: 1, isPrimary: true, accountType: 'Credit Card', openingAmount: 400 }),
                bankAccount({ id: 2, isPrimary: true, accountType: 'Loan', openingAmount: 900 }),
            ],
        })).toBe(0);
    });

    test('no double counting: money linked to the primary account is counted once, via its balance', () => {
        expect(wallet({
            income: [{ amount: 50, currency: 'GBP' }, { amount: 200, currency: 'GBP', accountId: 1 }],
            expenses: [{ amount: 100, currency: 'GBP', accountId: 1 }],
            accounts: [bankAccount({ id: 1, isPrimary: true, openingAmount: 1000 })],
        })).toBe(50 + (1000 + 200 - 100));
    });

    test('transfers out of the primary account reduce the wallet', () => {
        expect(wallet({
            accounts: [bankAccount({ id: 1, isPrimary: true, openingAmount: 1000 })],
            transfers: [{ fromAccountId: 1, fromAmount: 250, toAccountId: 2, toAmount: 250 }],
        })).toBe(750);
    });

    describe('currency conversion into the default currency', () => {
        test('unlinked records in other built-in currencies are converted', () => {
            expect(wallet({
                income: [{ amount: 100, currency: 'GBP' }],
                expenses: [{ amount: 100, currency: 'EUR' }],
            }, undefined, 'USD')).toBeCloseTo(127 - 108, 6);
        });

        test('a record with no currency is treated as GBP', () => {
            expect(wallet({ income: [{ amount: 100 }] }, undefined, 'USD')).toBeCloseTo(127, 6);
        });

        test('a primary account in a different currency has its balance converted', () => {
            expect(wallet({
                accounts: [bankAccount({ id: 1, isPrimary: true, currency: 'USD', openingAmount: 100 })],
            }, undefined, 'GBP')).toBeCloseTo(79, 6);
        });

        test('custom (non-fallback) currencies convert via their stored rate instead of being summed raw', () => {
            setCustomCurrencies([{ code: 'XYZ', name: 'Test', rate: 2, rateAgainst: 'GBP' }]);
            expect(wallet({
                income: [{ amount: 10, currency: 'XYZ' }],
                expenses: [{ amount: 3, currency: 'XYZ' }],
            }, undefined, 'GBP')).toBe(14);
        });
    });

    describe('Active View scoping', () => {
        const data = {
            income: [
                { amount: 100, currency: 'GBP', paidBy: '' },          // own (blank = own)
                { amount: 1000, currency: 'GBP', paidBy: 'Sam' },
            ],
            expenses: [
                { amount: 10, currency: 'GBP', paidBy: '' },
                { amount: 400, currency: 'GBP', paidBy: 'Sam' },
            ],
            accounts: [
                bankAccount({ id: 1, person: 'own', isPrimary: true, openingAmount: 50 }),
                bankAccount({ id: 2, person: 'Sam', isPrimary: true, openingAmount: 7000 }),
            ],
        };

        test('no activeView means everyone', () => {
            expect(wallet(data, undefined)).toBe((100 + 1000) - (10 + 400) + (50 + 7000));
        });

        test('["own"] covers blank paidBy records and own accounts only', () => {
            expect(wallet(data, ['own'])).toBe((100 - 10) + 50);
        });

        test('a named person covers just their records and accounts', () => {
            expect(wallet(data, ['Sam'])).toBe((1000 - 400) + 7000);
        });

        test('multiple people combine', () => {
            expect(wallet(data, ['own', 'Sam'])).toBe((100 + 1000) - (10 + 400) + (50 + 7000));
        });

        test('name matching is case-insensitive', () => {
            expect(wallet(data, ['sam'])).toBe((1000 - 400) + 7000);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('DataService.computeNetWorth', () => {
    const netWorth = (items, activeView) => {
        setKey('networth', items);
        return DataService.computeNetWorth(activeView);
    };
    const asset = (value, o = {}) => ({ id: Math.random(), type: 'asset', value, currency: 'GBP', person: 'own', ...o });
    const liability = (value, o = {}) => ({ id: Math.random(), type: 'liability', value, currency: 'GBP', person: 'own', ...o });

    test('no items is zero', () => {
        expect(netWorth([])).toBe(0);
    });

    test('assets add, liabilities subtract', () => {
        expect(netWorth([asset(1000), asset(250), liability(400)])).toBe(850);
    });

    test('can be negative', () => {
        expect(netWorth([asset(100), liability(500)])).toBe(-400);
    });

    test('items in other currencies are converted into the default currency (GBP when unset)', () => {
        expect(netWorth([asset(100, { currency: 'USD' }), liability(100, { currency: 'EUR' })])).toBeCloseTo(79 - 85, 6);
    });

    test('custom currencies convert via their stored rate', () => {
        setCustomCurrencies([{ code: 'XYZ', name: 'Test', rate: 2, rateAgainst: 'GBP' }]);
        expect(netWorth([asset(10, { currency: 'XYZ' })])).toBe(20);
    });

    test('Active View scopes to the selected people', () => {
        const items = [asset(100, { person: 'own' }), asset(1000, { person: 'Sam' }), liability(10, { person: 'Sam' })];
        expect(netWorth(items, ['own'])).toBe(100);
        expect(netWorth(items, ['Sam'])).toBe(990);
        expect(netWorth(items, ['own', 'Sam'])).toBe(1090);
        expect(netWorth(items)).toBe(1090);
    });

    // Regression guard: computeNetWorth once read financeApp_settings.defaultCurrency, but
    // every settings path (initialize, getSettings, updateSettings) renames that key to
    // `currency`, so a saved default was never found and snapshots were always converted
    // to GBP — then displayed in the user's real default-currency symbol by the history table.
    describe('default currency comes from the saved settings', () => {
        test('reads the `currency` key, which is how the app actually stores it', () => {
            store.setItem('financeApp_settings', JSON.stringify({ currency: 'USD' }));
            expect(netWorth([asset(100, { currency: 'GBP' })])).toBeCloseTo(127, 6);
            expect(netWorth([asset(100, { currency: 'USD' })])).toBe(100);
        });

        test('still honours a legacy un-migrated `defaultCurrency` key', () => {
            store.setItem('financeApp_settings', JSON.stringify({ defaultCurrency: 'USD' }));
            expect(netWorth([asset(100, { currency: 'GBP' })])).toBeCloseTo(127, 6);
        });

        test('`currency` wins if both keys are somehow present', () => {
            store.setItem('financeApp_settings', JSON.stringify({ currency: 'EUR', defaultCurrency: 'USD' }));
            expect(netWorth([asset(100, { currency: 'GBP' })])).toBeCloseTo(117, 6);
        });

        test('falls back to GBP when no currency is saved', () => {
            store.setItem('financeApp_settings', JSON.stringify({ displayName: 'x' }));
            expect(netWorth([asset(100, { currency: 'USD' })])).toBeCloseTo(79, 6);
        });

        test('follows a currency change made through the real updateSettings path', async () => {
            await DataService.updateSettings({ defaultCurrency: 'INR' }); // legacy-shaped call, gets renamed to `currency`
            expect(JSON.parse(store.getItem('financeApp_settings')).currency).toBe('INR');
            expect(netWorth([asset(100, { currency: 'GBP' })])).toBeCloseTo(10650, 6);
        });
    });
});
