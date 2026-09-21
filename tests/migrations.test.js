const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// The one-time schema migrations in DataService. Several run unconditionally on
// EVERY app load (see App's startup effect), so each one's contract is
// "idempotent": legacy data gets converted, already-migrated data is left alone,
// and running it again changes nothing. Every migration describes itself that way
// in its own comment — these tests hold it to that.
const { DataService, matchesActiveView, __sandbox } = loadInlineClasses(['DateUtils', 'DataService', 'matchesActiveView']);

const store = __sandbox.localStorage;
const key = name => 'financeApp_' + name;
const put = (name, value) => store.setItem(key(name), JSON.stringify(value));
const read = name => { const v = store.getItem(key(name)); return v === null ? null : JSON.parse(v); };

// Every localStorage key a migration can touch, for whole-state before/after comparisons.
const WATCHED = ['expenses', 'income', 'categories', 'bankAccounts', 'networth', 'assetCategories',
    'liabilityCategories', 'debts', 'bills', 'reconciliations', 'goals', 'recurring', 'netWorthHistory'];
const snapshot = () => Object.fromEntries(WATCHED.map(n => [n, store.getItem(key(n))]));

beforeEach(() => {
    store.clear();
    DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
    DataService.isInitialized = true; // in-memory state is the test's own; initialize() must not re-read
});

// ─────────────────────────────────────────────────────────────────────────────
describe('migratePersonName', () => {
    const OLD = 'Sam', NEW = 'Samantha';

    const seedEverything = () => {
        DataService.data.expenses = [
            { id: 1, paidBy: OLD, amount: 10 },
            { id: 2, paidBy: 'Alex', amount: 20 },
            { id: 3, paidBy: '', amount: 30 },
        ];
        DataService.data.income = [{ id: 1, paidBy: OLD }, { id: 2, paidBy: 'Alex' }];
        put('bankAccounts', [{ id: 1, person: OLD }, { id: 2, person: 'Alex' }, { id: 3, person: 'own' }]);
        put('networth', [{ id: 1, person: OLD, type: 'asset' }, { id: 2, person: 'Alex', type: 'asset' }]);
        put('debts', [
            { id: 1, person: OLD, createdInView: [OLD] },
            { id: 2, person: 'own', createdInView: ['own', OLD] },
            { id: 3, person: 'Alex', createdInView: ['Alex'] },
        ]);
        put('bills', [{ id: 1, person: OLD, createdInView: [OLD, 'own'] }, { id: 2, person: 'Alex', createdInView: ['Alex'] }]);
        put('reconciliations', [{ id: 1, person: OLD }, { id: 2, person: 'Alex' }]);
    };

    test('renames the person on every person-scoped collection', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);

        expect(DataService.data.expenses.map(e => e.paidBy)).toEqual([NEW, 'Alex', '']);
        expect(DataService.data.income.map(i => i.paidBy)).toEqual([NEW, 'Alex']);
        expect(read('bankAccounts').map(a => a.person)).toEqual([NEW, 'Alex', 'own']);
        expect(read('networth').map(i => i.person)).toEqual([NEW, 'Alex']);
        expect(read('debts').map(d => d.person)).toEqual([NEW, 'own', 'Alex']);
        expect(read('bills').map(b => b.person)).toEqual([NEW, 'Alex']);
        expect(read('reconciliations').map(r => r.person)).toEqual([NEW, 'Alex']);
    });

    test('also renames the person inside createdInView on debts and bills', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);
        expect(read('debts').map(d => d.createdInView)).toEqual([[NEW], ['own', NEW], ['Alex']]);
        expect(read('bills').map(b => b.createdInView)).toEqual([[NEW, 'own'], ['Alex']]);
    });

    test('a debt matched only through createdInView (person is someone else) is still updated and re-stamped', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);
        const debt = read('debts').find(d => d.id === 2);
        expect(debt.person).toBe('own');
        expect(typeof debt.updatedAt).toBe('string');
    });

    test('persists the changes to localStorage, not just memory', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);
        expect(JSON.parse(store.getItem(key('expenses'))).map(e => e.paidBy)).toEqual([NEW, 'Alex', '']);
        expect(JSON.parse(store.getItem(key('income'))).map(i => i.paidBy)).toEqual([NEW, 'Alex']);
    });

    test('stamps updatedAt on renamed records only, so the edit wins a cross-device merge', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);
        const [renamed, other] = DataService.data.expenses;
        expect(typeof renamed.updatedAt).toBe('string');
        expect(other.updatedAt).toBeUndefined();
        expect(read('bankAccounts')[1].updatedAt).toBeUndefined();
        expect(read('bankAccounts')[0].updatedAt).toEqual(expect.any(String));
    });

    test('leaves everyone else untouched', () => {
        seedEverything();
        const alexBefore = JSON.stringify(read('networth')[1]);
        DataService.migratePersonName(OLD, NEW);
        expect(JSON.stringify(read('networth')[1])).toBe(alexBefore);
        expect(DataService.data.expenses[2]).toEqual({ id: 3, paidBy: '', amount: 30 });
    });

    test('does not create or rewrite collections that had nothing to rename', () => {
        DataService.data.expenses = [{ id: 1, paidBy: OLD }];
        DataService.migratePersonName(OLD, NEW);
        ['bankAccounts', 'networth', 'debts', 'bills', 'reconciliations'].forEach(n => {
            expect(store.getItem(key(n))).toBeNull();
        });
    });

    test('is idempotent: running it again changes nothing, including timestamps', () => {
        seedEverything();
        DataService.migratePersonName(OLD, NEW);
        const afterFirst = snapshot();
        const memoryAfterFirst = JSON.stringify(DataService.data);
        DataService.migratePersonName(OLD, NEW);
        expect(snapshot()).toEqual(afterFirst);
        expect(JSON.stringify(DataService.data)).toBe(memoryAfterFirst);
    });

    test('a name nobody uses is a harmless no-op on the data', () => {
        seedEverything();
        const before = JSON.stringify(DataService.data.expenses);
        DataService.migratePersonName('Nobody', 'Someone');
        expect(JSON.stringify(DataService.data.expenses)).toBe(before);
    });

    test('works through the real rename path (updatePerson), not only when called directly', () => {
        DataService.data.settings.people = [{ id: 1, name: OLD, relationship: '', isDefault: false }];
        DataService.data.expenses = [{ id: 1, paidBy: OLD }];
        DataService.updatePerson(1, { name: ' ' + NEW + ' ' });
        expect(DataService.data.settings.people[0].name).toBe(NEW);
        expect(DataService.data.expenses[0].paidBy).toBe(NEW);
    });

    // Regression guard: goals, recurring schedules, Net Worth history snapshots, per-person
    // category budgets and the stored Active View are person-scoped by NAME too. They were once
    // missed here, so after a rename they silently dropped out of every screen (the same class
    // of bug as the collections above).
    describe('person-scoped data beyond the core collections', () => {
        const budgetCategory = (overrides = {}) => ({
            id: 1, name: 'Food', subcategories: [],
            personBudgets: { own: { monthlyBudget: 50 }, [OLD]: { monthlyBudget: 120 } },
            ...overrides,
        });

        test('savings goals: owner follows the rename', () => {
            put('goals', [{ id: 1, name: 'Holiday', owner: OLD }, { id: 2, name: 'Car', owner: 'Alex' }, { id: 3, name: 'Mine', owner: 'own' }]);
            DataService.migratePersonName(OLD, NEW);
            expect(read('goals').map(g => g.owner)).toEqual([NEW, 'Alex', 'own']);
        });

        test('recurring schedules: paidBy (expense/income) and person (asset/liability) follow the rename', () => {
            put('recurring', [
                { id: 1, type: 'expense', templateExpense: { paidBy: OLD } },
                { id: 2, type: 'income', templateExpense: { paidBy: OLD } },
                { id: 3, type: 'asset', templateExpense: { person: OLD } },
                { id: 4, type: 'liability', templateExpense: { person: OLD } },
                { id: 5, type: 'expense', templateExpense: { paidBy: 'Alex' } },
            ]);
            DataService.migratePersonName(OLD, NEW);
            const [e, i, a, l, other] = read('recurring');
            expect(e.templateExpense.paidBy).toBe(NEW);
            expect(i.templateExpense.paidBy).toBe(NEW);
            expect(a.templateExpense.person).toBe(NEW);
            expect(l.templateExpense.person).toBe(NEW);
            expect(other.templateExpense.paidBy).toBe('Alex');
        });

        test('recurring schedules without a template are skipped rather than crashing', () => {
            put('recurring', [{ id: 1, type: 'expense' }, { id: 2, type: 'expense', templateExpense: { paidBy: OLD } }]);
            expect(() => DataService.migratePersonName(OLD, NEW)).not.toThrow();
            expect(read('recurring')[1].templateExpense.paidBy).toBe(NEW);
        });

        test('Net Worth history snapshots: the person is renamed inside `view`, other names kept', () => {
            put('netWorthHistory', [
                { id: 1, date: '2026-01-01', netWorth: 100, view: [OLD] },
                { id: 2, date: '2026-02-01', netWorth: 200, view: ['own', OLD] },
                { id: 3, date: '2026-03-01', netWorth: 300, view: ['Alex'] },
                { id: 4, date: '2026-04-01', netWorth: 400 },   // legacy snapshot with no view tag
            ]);
            DataService.migratePersonName(OLD, NEW);
            expect(read('netWorthHistory').map(e => e.view)).toEqual([[NEW], ['own', NEW], ['Alex'], undefined]);
        });

        test('category budgets: the person\'s budget entry moves to the new name, contents intact', () => {
            DataService.data.categories = [budgetCategory()];
            DataService.migratePersonName(OLD, NEW);
            const pb = DataService.data.categories[0].personBudgets;
            expect(pb).toEqual({ own: { monthlyBudget: 50 }, [NEW]: { monthlyBudget: 120 } });
            expect(pb).not.toHaveProperty(OLD);
            expect(read('categories')[0].personBudgets[NEW]).toEqual({ monthlyBudget: 120 }); // persisted
        });

        test('category budgets: categories with no entry for the person, or no budgets at all, are untouched', () => {
            DataService.data.categories = [
                budgetCategory({ id: 1, personBudgets: { own: { monthlyBudget: 50 } } }),
                { id: 2, name: 'Legacy', subcategories: [], monthlyBudget: 10 },   // not yet migrated to personBudgets
            ];
            const before = JSON.stringify(DataService.data.categories);
            DataService.migratePersonName(OLD, NEW);
            expect(JSON.stringify(DataService.data.categories)).toBe(before);
            expect(store.getItem(key('categories'))).toBeNull();
        });

        test('category budgets: an entry already under the new name is never overwritten, and nothing is destroyed', () => {
            // e.g. left behind by a since-deleted person of that name (deletePerson doesn't clear budgets)
            DataService.data.categories = [budgetCategory({
                personBudgets: { own: { monthlyBudget: 50 }, [OLD]: { monthlyBudget: 120 }, [NEW]: { monthlyBudget: 999 } },
            })];
            DataService.migratePersonName(OLD, NEW);
            expect(DataService.data.categories[0].personBudgets).toEqual({
                own: { monthlyBudget: 50 }, [OLD]: { monthlyBudget: 120 }, [NEW]: { monthlyBudget: 999 },
            });
        });

        test('Active View: a stored selection containing the old name follows the rename', () => {
            store.setItem(key('activeView'), JSON.stringify(['own', OLD]));
            DataService.migratePersonName(OLD, NEW);
            expect(read('activeView')).toEqual(['own', NEW]);
        });

        test('Active View: a selection that does not include the person is left alone', () => {
            store.setItem(key('activeView'), JSON.stringify(['own', 'Alex']));
            DataService.migratePersonName(OLD, NEW);
            expect(read('activeView')).toEqual(['own', 'Alex']);
        });

        test('Active View: nothing stored, or a corrupt value, does not throw and is not "repaired" into existence', () => {
            expect(() => DataService.migratePersonName(OLD, NEW)).not.toThrow();
            expect(store.getItem(key('activeView'))).toBeNull();
            store.setItem(key('activeView'), '{not json');
            expect(() => DataService.migratePersonName(OLD, NEW)).not.toThrow();
            expect(store.getItem(key('activeView'))).toBe('{not json');
        });

        test('every record it changes is stamped with updatedAt so the rename wins a cross-device merge', () => {
            put('goals', [{ id: 1, owner: OLD }, { id: 2, owner: 'Alex' }]);
            put('recurring', [{ id: 1, type: 'expense', templateExpense: { paidBy: OLD } }, { id: 2, type: 'expense', templateExpense: { paidBy: 'Alex' } }]);
            put('netWorthHistory', [{ id: 1, view: [OLD] }, { id: 2, view: ['Alex'] }]);
            DataService.data.categories = [budgetCategory()];
            DataService.migratePersonName(OLD, NEW);
            expect(read('goals').map(g => typeof g.updatedAt)).toEqual(['string', 'undefined']);
            expect(read('recurring').map(s => typeof s.updatedAt)).toEqual(['string', 'undefined']);
            expect(read('netWorthHistory').map(e => typeof e.updatedAt)).toEqual(['string', 'undefined']);
            expect(typeof DataService.data.categories[0].updatedAt).toBe('string');
        });

        test('nothing else is created or rewritten when the person has no such data', () => {
            DataService.data.expenses = [{ id: 1, paidBy: OLD }];
            DataService.migratePersonName(OLD, NEW);
            ['goals', 'recurring', 'netWorthHistory', 'categories', 'activeView'].forEach(n => {
                expect(store.getItem(key(n))).toBeNull();
            });
        });

        test('is idempotent across the new collections too', () => {
            put('goals', [{ id: 1, owner: OLD }]);
            put('recurring', [{ id: 1, type: 'asset', templateExpense: { person: OLD } }]);
            put('netWorthHistory', [{ id: 1, view: [OLD] }]);
            store.setItem(key('activeView'), JSON.stringify([OLD]));
            DataService.data.categories = [budgetCategory()];
            DataService.migratePersonName(OLD, NEW);
            const afterFirst = { ...snapshot(), activeView: store.getItem(key('activeView')) };
            const memoryAfterFirst = JSON.stringify(DataService.data);
            DataService.migratePersonName(OLD, NEW);
            expect({ ...snapshot(), activeView: store.getItem(key('activeView')) }).toEqual(afterFirst);
            expect(JSON.stringify(DataService.data)).toBe(memoryAfterFirst);
        });

        test('renaming twice in a row (A→B, then B→C) carries everything all the way through', () => {
            put('goals', [{ id: 1, owner: OLD }]);
            store.setItem(key('activeView'), JSON.stringify([OLD]));
            DataService.data.categories = [budgetCategory()];
            DataService.migratePersonName(OLD, NEW);
            DataService.migratePersonName(NEW, 'Sammy');
            expect(read('goals')[0].owner).toBe('Sammy');
            expect(read('activeView')).toEqual(['Sammy']);
            expect(Object.keys(DataService.data.categories[0].personBudgets)).toEqual(['own', 'Sammy']);
        });

        test('end to end through the real rename path: the renamed person\'s data is visible under the new name', () => {
            DataService.data.settings.people = [{ id: 1, name: OLD, relationship: 'Spouse', isDefault: false }];
            DataService.data.expenses = [{ id: 1, paidBy: OLD }];
            put('goals', [{ id: 1, owner: OLD }]);
            put('recurring', [{ id: 1, type: 'expense', templateExpense: { paidBy: OLD } }, { id: 2, type: 'asset', templateExpense: { person: OLD } }]);
            put('netWorthHistory', [{ id: 1, view: [OLD] }]);
            store.setItem(key('activeView'), JSON.stringify([OLD]));

            DataService.updatePerson(1, { name: NEW });

            const view = read('activeView');
            expect(view).toEqual([NEW]);
            // The same visibility checks the screens apply:
            expect(matchesActiveView(DataService.data.expenses[0].paidBy, view)).toBe(true);
            expect(matchesActiveView(read('goals')[0].owner, view)).toBe(true);
            expect(matchesActiveView(read('recurring')[0].templateExpense.paidBy, view)).toBe(true);
            expect(matchesActiveView(read('recurring')[1].templateExpense.person, view)).toBe(true);
            expect(read('netWorthHistory')[0].view.some(v => view.includes(v))).toBe(true);
        });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('migrateLegacyNetWorthCategories', () => {
    const ASSET_CATS = [
        { id: 101, name: 'Investment', locked: true, subcategories: [] },
        { id: 102, name: 'Property', locked: true, subcategories: [] },
        { id: 103, name: 'My Custom Pot', locked: false, subcategories: [] },
    ];
    const LIAB_CATS = [
        { id: 201, name: 'Mortgage', locked: true, subcategories: [] },
        { id: 202, name: 'Loans', locked: true, subcategories: [] },
    ];
    beforeEach(() => {
        put('assetCategories', ASSET_CATS);
        put('liabilityCategories', LIAB_CATS);
    });

    test('converts the old flat `category` name string into a `categoryId`, dropping the old field', () => {
        put('networth', [{ id: 1, type: 'asset', name: 'ISA', category: 'Investment' }]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth')[0]).toEqual({ id: 1, type: 'asset', name: 'ISA', categoryId: 101 });
    });

    test('matches assets and liabilities against their own category lists', () => {
        put('networth', [
            { id: 1, type: 'asset', category: 'Property' },
            { id: 2, type: 'liability', category: 'Mortgage' },
            { id: 3, type: 'asset', category: 'My Custom Pot' },
        ]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth').map(i => i.categoryId)).toEqual([102, 201, 103]);
    });

    test('a liability never matches an asset category of the same name (and vice versa)', () => {
        put('networth', [
            { id: 1, type: 'liability', category: 'Investment' },   // exists only as an asset category
            { id: 2, type: 'asset', category: 'Mortgage' },         // exists only as a liability category
        ]);
        DataService.migrateLegacyNetWorthCategories();
        const items = read('networth');
        expect(items.map(i => i.categoryId)).toEqual([undefined, undefined]);
        expect(items.map(i => i.category)).toEqual(['Investment', 'Mortgage']);
    });

    test('a category name with no match is left as legacy data (retried on the next load), not lost', () => {
        put('networth', [{ id: 1, type: 'asset', category: 'Deleted Category' }]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth')[0]).toEqual({ id: 1, type: 'asset', category: 'Deleted Category' });
    });

    test('an item that already has a categoryId is never touched, even with a stray `category`', () => {
        put('networth', [{ id: 1, type: 'asset', categoryId: 102, category: 'Investment' }]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth')[0]).toEqual({ id: 1, type: 'asset', categoryId: 102, category: 'Investment' });
    });

    test('an item with neither field is left alone', () => {
        put('networth', [{ id: 1, type: 'asset', name: 'Mystery' }]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth')[0]).toEqual({ id: 1, type: 'asset', name: 'Mystery' });
    });

    test('only legacy items in a mixed list are converted', () => {
        put('networth', [
            { id: 1, type: 'asset', categoryId: 101 },
            { id: 2, type: 'asset', category: 'Property' },
        ]);
        DataService.migrateLegacyNetWorthCategories();
        expect(read('networth').map(i => i.categoryId)).toEqual([101, 102]);
    });

    test('is idempotent: a second run leaves storage byte-for-byte identical', () => {
        put('networth', [
            { id: 1, type: 'asset', category: 'Investment' },
            { id: 2, type: 'asset', category: 'Deleted Category' },
            { id: 3, type: 'liability', categoryId: 202 },
        ]);
        DataService.migrateLegacyNetWorthCategories();
        const afterFirst = snapshot();
        DataService.migrateLegacyNetWorthCategories();
        expect(snapshot()).toEqual(afterFirst);
    });

    test('does not rewrite the item list when there is nothing to migrate', () => {
        DataService.migrateLegacyNetWorthCategories();
        expect(store.getItem(key('networth'))).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('migrateIncomeWhosIncome', () => {
    test('moves the legacy `whosIncome` person into `paidBy` and removes the old field', async () => {
        DataService.data.income = [{ id: 1, amount: 100, source: 'Refund', whosIncome: 'Sam' }];
        await DataService.migrateIncomeWhosIncome();
        expect(DataService.data.income[0]).toEqual({ id: 1, amount: 100, source: 'Refund', paidBy: 'Sam' });
    });

    test('persists to localStorage', async () => {
        DataService.data.income = [{ id: 1, whosIncome: 'Sam' }];
        await DataService.migrateIncomeWhosIncome();
        expect(read('income')).toEqual([{ id: 1, paidBy: 'Sam' }]);
    });

    test('an existing paidBy wins; the stale whosIncome is still discarded', async () => {
        DataService.data.income = [{ id: 1, paidBy: 'Alex', whosIncome: 'Sam' }];
        await DataService.migrateIncomeWhosIncome();
        expect(DataService.data.income[0]).toEqual({ id: 1, paidBy: 'Alex' });
    });

    test('an empty whosIncome (meaning "own") is cleaned up without inventing a person', async () => {
        DataService.data.income = [{ id: 1, whosIncome: '' }];
        await DataService.migrateIncomeWhosIncome();
        expect(DataService.data.income[0]).toEqual({ id: 1, paidBy: '' });
    });

    test('records already in the new shape are untouched', async () => {
        DataService.data.income = [{ id: 1, paidBy: 'Sam', amount: 5 }, { id: 2, paidBy: '', amount: 6 }];
        const before = JSON.stringify(DataService.data.income);
        await DataService.migrateIncomeWhosIncome();
        expect(JSON.stringify(DataService.data.income)).toBe(before);
    });

    test('only legacy records in a mixed list change', async () => {
        DataService.data.income = [{ id: 1, paidBy: 'Alex' }, { id: 2, whosIncome: 'Sam' }];
        await DataService.migrateIncomeWhosIncome();
        expect(DataService.data.income.map(i => i.paidBy)).toEqual(['Alex', 'Sam']);
        expect(DataService.data.income.some(i => 'whosIncome' in i)).toBe(false);
    });

    test('is idempotent: a second run leaves storage byte-for-byte identical', async () => {
        DataService.data.income = [{ id: 1, whosIncome: 'Sam' }, { id: 2, paidBy: 'Alex', whosIncome: 'Sam' }, { id: 3, paidBy: '' }];
        await DataService.migrateIncomeWhosIncome();
        const afterFirst = snapshot();
        const memoryAfterFirst = JSON.stringify(DataService.data.income);
        await DataService.migrateIncomeWhosIncome();
        expect(snapshot()).toEqual(afterFirst);
        expect(JSON.stringify(DataService.data.income)).toBe(memoryAfterFirst);
    });

    test('does not write when there is nothing to migrate', async () => {
        DataService.data.income = [{ id: 1, paidBy: 'Sam' }];
        await DataService.migrateIncomeWhosIncome();
        expect(store.getItem(key('income'))).toBeNull();
    });

    test('loads legacy data straight from storage on a cold start (real initialize() path)', async () => {
        put('income', [{ id: 1, amount: 100, whosIncome: 'Sam' }]);
        DataService.isInitialized = false;
        DataService.data = { expenses: [], income: [], settings: { currency: 'GBP' }, categories: [] };
        await DataService.migrateIncomeWhosIncome();
        expect(read('income')).toEqual([{ id: 1, amount: 100, paidBy: 'Sam' }]);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('migrateCategoryBudgetsToPersonScope', () => {
    const legacyCategory = (overrides = {}) => ({
        id: 1, name: 'Food', subcategories: ['Groceries', 'Coffee'],
        monthlyBudget: 250, budgetCurrency: 'USD', budgetStartDate: '2026-01-01',
        useSubcategoryBudgets: true,
        subcategoryBudgets: { Groceries: 150, Coffee: 30 },
        subcategoryBudgetCurrencies: { Groceries: 'USD', Coffee: 'USD' },
        notificationThreshold: 90,
        budgetHistory: [{ amount: 200, currency: 'USD', endDate: '2025-12-31' }],
        subcategoryBudgetHistory: { Groceries: [{ amount: 100 }] },
        ...overrides,
    });
    const FLAT_FIELDS = ['monthlyBudget', 'budgetCurrency', 'budgetStartDate', 'useSubcategoryBudgets',
        'subcategoryBudgets', 'subcategoryBudgetCurrencies', 'notificationThreshold', 'budgetHistory', 'subcategoryBudgetHistory'];

    test('moves every flat budget field into personBudgets.own, preserving the values', () => {
        DataService.data.categories = [legacyCategory()];
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(DataService.data.categories[0].personBudgets).toEqual({
            own: {
                monthlyBudget: 250, budgetCurrency: 'USD', budgetStartDate: '2026-01-01',
                useSubcategoryBudgets: true,
                subcategoryBudgets: { Groceries: 150, Coffee: 30 },
                subcategoryBudgetCurrencies: { Groceries: 'USD', Coffee: 'USD' },
                notificationThreshold: 90,
                budgetHistory: [{ amount: 200, currency: 'USD', endDate: '2025-12-31' }],
                subcategoryBudgetHistory: { Groceries: [{ amount: 100 }] },
            },
        });
    });

    test('removes the flat fields but keeps the category identity (id, name, subcategories)', () => {
        DataService.data.categories = [legacyCategory()];
        DataService.migrateCategoryBudgetsToPersonScope();
        const cat = DataService.data.categories[0];
        FLAT_FIELDS.forEach(f => expect(cat).not.toHaveProperty(f));
        expect(cat).toMatchObject({ id: 1, name: 'Food', subcategories: ['Groceries', 'Coffee'] });
    });

    test('a bare legacy category gets sensible defaults', () => {
        DataService.data.categories = [{ id: 2, name: 'Bare', subcategories: [] }];
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(DataService.data.categories[0].personBudgets.own).toEqual({
            monthlyBudget: 0, budgetCurrency: undefined, budgetStartDate: undefined,
            useSubcategoryBudgets: false, subcategoryBudgets: {}, subcategoryBudgetCurrencies: {},
            notificationThreshold: 80, budgetHistory: [], subcategoryBudgetHistory: {},
        });
    });

    test('persists to localStorage', () => {
        DataService.data.categories = [legacyCategory()];
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(read('categories')[0].personBudgets.own.monthlyBudget).toBe(250);
        expect(read('categories')[0]).not.toHaveProperty('monthlyBudget');
    });

    test('an already-migrated category is left completely untouched (even with leftover flat fields)', () => {
        const migrated = { id: 3, name: 'Done', subcategories: [], personBudgets: { own: { monthlyBudget: 10 }, Sam: { monthlyBudget: 20 } }, monthlyBudget: 999 };
        DataService.data.categories = [migrated];
        const before = JSON.stringify(migrated);
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(JSON.stringify(DataService.data.categories[0])).toBe(before);
    });

    test('only legacy categories in a mixed list are converted', () => {
        DataService.data.categories = [
            legacyCategory({ id: 1 }),
            { id: 2, name: 'Modern', subcategories: [], personBudgets: { own: { monthlyBudget: 5 } } },
        ];
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(DataService.data.categories[0].personBudgets.own.monthlyBudget).toBe(250);
        expect(DataService.data.categories[1].personBudgets).toEqual({ own: { monthlyBudget: 5 } });
    });

    test('is idempotent: a second run leaves storage byte-for-byte identical', () => {
        DataService.data.categories = [legacyCategory(), { id: 2, name: 'Bare', subcategories: [] }];
        DataService.migrateCategoryBudgetsToPersonScope();
        const afterFirst = snapshot();
        const memoryAfterFirst = JSON.stringify(DataService.data.categories);
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(snapshot()).toEqual(afterFirst);
        expect(JSON.stringify(DataService.data.categories)).toBe(memoryAfterFirst);
    });

    test('does not write when every category is already migrated', () => {
        DataService.data.categories = [{ id: 1, name: 'Modern', subcategories: [], personBudgets: {} }];
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(store.getItem(key('categories'))).toBeNull();
    });

    test('an empty category list is a harmless no-op', () => {
        DataService.migrateCategoryBudgetsToPersonScope();
        expect(store.getItem(key('categories'))).toBeNull();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('migrateNetWorthOriginalAmounts', () => {
    test('stamps originalAmount = value on items that predate the field', () => {
        put('networth', [{ id: 1, value: 500 }, { id: 2, value: 12.5 }]);
        DataService.migrateNetWorthOriginalAmounts();
        expect(read('networth').map(i => i.originalAmount)).toEqual([500, 12.5]);
    });

    test('items that already have an originalAmount keep it, even when it differs from value', () => {
        put('networth', [{ id: 1, value: 700, originalAmount: 500 }]);
        DataService.migrateNetWorthOriginalAmounts();
        expect(read('networth')[0]).toEqual({ id: 1, value: 700, originalAmount: 500 });
    });

    test('a legitimate originalAmount of 0 is preserved, not mistaken for "missing"', () => {
        put('networth', [{ id: 1, value: 300, originalAmount: 0 }]);
        DataService.migrateNetWorthOriginalAmounts();
        expect(read('networth')[0].originalAmount).toBe(0);
    });

    test('an explicit null is treated as missing and stamped', () => {
        put('networth', [{ id: 1, value: 300, originalAmount: null }]);
        DataService.migrateNetWorthOriginalAmounts();
        expect(read('networth')[0].originalAmount).toBe(300);
    });

    test('only legacy items in a mixed list change', () => {
        put('networth', [{ id: 1, value: 100 }, { id: 2, value: 900, originalAmount: 800 }]);
        DataService.migrateNetWorthOriginalAmounts();
        expect(read('networth').map(i => i.originalAmount)).toEqual([100, 800]);
    });

    test('is idempotent: a second run leaves storage byte-for-byte identical', () => {
        put('networth', [{ id: 1, value: 100 }, { id: 2, value: 900, originalAmount: 800 }, { id: 3, value: 5, originalAmount: 0 }]);
        DataService.migrateNetWorthOriginalAmounts();
        const afterFirst = snapshot();
        DataService.migrateNetWorthOriginalAmounts();
        expect(snapshot()).toEqual(afterFirst);
    });

    test('does not write when there is nothing to migrate', () => {
        DataService.migrateNetWorthOriginalAmounts();
        expect(store.getItem(key('networth'))).toBeNull();
        put('networth', [{ id: 1, value: 1, originalAmount: 1 }]);
        const before = store.getItem(key('networth'));
        DataService.migrateNetWorthOriginalAmounts();
        expect(store.getItem(key('networth'))).toBe(before);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the whole startup migration sequence, as App runs it on every load', () => {
    const runAll = async () => {
        DataService.migrateCategoryBudgetsToPersonScope();
        DataService.migrateNetWorthOriginalAmounts();
        DataService.migrateLegacyNetWorthCategories();
        await DataService.migrateIncomeWhosIncome();
    };

    test('converts a fully legacy dataset, and a second boot changes nothing at all', async () => {
        put('assetCategories', [{ id: 101, name: 'Investment', locked: true, subcategories: [] }]);
        put('liabilityCategories', [{ id: 201, name: 'Loans', locked: true, subcategories: [] }]);
        put('networth', [
            { id: 1, type: 'asset', value: 500, category: 'Investment' },
            { id: 2, type: 'liability', value: 90, category: 'Loans' },
        ]);
        DataService.data.income = [{ id: 1, amount: 50, whosIncome: 'Sam' }];
        DataService.data.categories = [{ id: 1, name: 'Food', subcategories: [], monthlyBudget: 100 }];

        await runAll();
        const afterFirstBoot = snapshot();

        expect(read('networth')).toEqual([
            { id: 1, type: 'asset', value: 500, originalAmount: 500, categoryId: 101 },
            { id: 2, type: 'liability', value: 90, originalAmount: 90, categoryId: 201 },
        ]);
        expect(read('income')).toEqual([{ id: 1, amount: 50, paidBy: 'Sam' }]);
        expect(read('categories')[0].personBudgets.own.monthlyBudget).toBe(100);

        await runAll();
        expect(snapshot()).toEqual(afterFirstBoot);
    });

    test('a brand-new account only gets the default Net Worth categories seeded, and a second boot changes nothing', async () => {
        await runAll();
        const afterFirstBoot = snapshot();

        // Reading the category lists is what seeds the defaults; nothing else is created.
        const untouched = WATCHED.filter(n => n !== 'assetCategories' && n !== 'liabilityCategories');
        untouched.forEach(n => expect(afterFirstBoot[n]).toBeNull());
        expect(read('assetCategories').map(c => c.name)).toEqual(
            ['Investment', 'Property', 'Pension & Retirement', 'Vehicles', 'Bank & Savings', 'Cash', 'Other Asset']);
        expect(read('liabilityCategories').map(c => c.name)).toEqual(
            ['Mortgage', 'Loans', 'Credit Cards', 'Overdraft', 'Money Owed to Others', 'Other Liability']);

        await runAll();
        expect(snapshot()).toEqual(afterFirstBoot); // seeded once — never re-seeded with new ids
    });
});
