const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Two-device merge rules added after the Phase 12 sync test:
//  - people and added currencies inside settings merge item by item (issue 1)
//  - a record changed on both devices since the last sync is flagged, not silently dropped (issue 2, option 1)
//  - Net Worth item history keeps both devices' entries (issue 2, option 2)
const { DataService, __sandbox } = loadInlineClasses(['DataService', 'getBackupTimestamp']);
const store = __sandbox.localStorage;

const COLLECTIONS = ['expenses', 'income', 'goals', 'bills', 'recurring', 'debts', 'netWorthHistory', 'categories', 'assetCategories', 'liabilityCategories', 'networth', 'bankAccounts', 'transfers', 'reconciliations'];
const T = { sync: '2026-01-02T10:00:00.000Z', before: '2026-01-01T10:00:00.000Z', a: '2026-01-02T11:00:00.000Z', b: '2026-01-02T12:00:00.000Z' };
const makeBackup = (data = {}, createdAt = T.b) => {
    const full = { settings: { currency: 'GBP' }, notifSettings: null, _deletionLog: {} };
    COLLECTIONS.forEach(k => { full[k] = []; });
    return { version: '1.0', createdAt, userId: 'user-1', data: { ...full, ...data } };
};
const conflicts = () => JSON.parse(store.getItem('financeApp_syncConflicts') || '{}');
const merge = (l, c) => DataService.mergeBackups(l, c);

beforeEach(() => { store.clear(); store.setItem('financeApp_lastCloudSync', T.sync); });

describe('people and added currencies (settings lists)', () => {
    const me = { id: 1, name: 'Alex', systemManaged: true, updatedAt: T.before };
    test('a person added on each device ends up on both', () => {
        const local = makeBackup({ settings: { currency: 'GBP', people: [me, { id: 2, name: 'Priya', updatedAt: T.a }] } }, T.b);
        const cloud = makeBackup({ settings: { currency: 'GBP', people: [me, { id: 3, name: 'Sam', updatedAt: T.a }] } }, T.a);
        expect(merge(local, cloud).data.settings.people.map(p => p.name).sort()).toEqual(['Alex', 'Priya', 'Sam']);
    });
    test('a currency added on the other device is kept', () => {
        const local = makeBackup({ settings: { currency: 'GBP', customCurrencies: [] } }, T.b);
        const cloud = makeBackup({ settings: { currency: 'GBP', customCurrencies: [{ id: 9, code: 'KES', rate: 0.006, rateUpdatedAt: T.a }] } }, T.a);
        expect(merge(local, cloud).data.settings.customCurrencies.map(c => c.code)).toEqual(['KES']);
    });
    test('the newer edit of the same person wins', () => {
        const local = makeBackup({ settings: { people: [{ id: 2, name: 'Priya', relationship: 'Partner', updatedAt: T.a }] } }, T.b);
        const cloud = makeBackup({ settings: { people: [{ id: 2, name: 'Priya', relationship: 'Wife', updatedAt: T.b }] } }, T.a);
        expect(merge(local, cloud).data.settings.people[0].relationship).toBe('Wife');
    });
    test('duplicates by name, by code, or a second "you" record are dropped', () => {
        const local = makeBackup({ settings: { people: [me, { id: 2, name: 'Sam' }], customCurrencies: [{ id: 5, code: 'KES' }] } }, T.b);
        const cloud = makeBackup({ settings: { people: [{ id: 7, name: 'Alex T', systemManaged: true }, { id: 8, name: 'sam' }], customCurrencies: [{ id: 6, code: 'kes' }] } }, T.a);
        const s = merge(local, cloud).data.settings;
        expect(s.people.map(p => p.id)).toEqual([1, 2]);
        expect(s.customCurrencies.map(c => c.id)).toEqual([5]);
    });
    test('a person or currency deleted on one device stays deleted', () => {
        const local = makeBackup({ settings: { people: [], customCurrencies: [] }, _deletionLog: { people: { 3: T.a }, customCurrencies: { 9: T.a } } }, T.b);
        const cloud = makeBackup({ settings: { people: [{ id: 3, name: 'Sam' }], customCurrencies: [{ id: 9, code: 'KES' }] } }, T.a);
        const s = merge(local, cloud).data.settings;
        expect(s.people).toEqual([]);
        expect(s.customCurrencies).toEqual([]);
    });
    test('scalar settings still follow the newer backup', () => {
        const local = makeBackup({ settings: { currency: 'USD', people: [] } }, T.b);
        const cloud = makeBackup({ settings: { currency: 'EUR', people: [] } }, T.a);
        expect(merge(local, cloud).data.settings.currency).toBe('USD');
    });
    test('deletePerson and deleteCustomCurrency record a tombstone', () => {
        DataService.data = { expenses: [], income: [], settings: { currency: 'GBP', people: [{ id: 4, name: 'Sam' }], customCurrencies: [{ id: 5, code: 'KES' }] }, categories: [] };
        DataService.deletePerson(4);
        DataService.deleteCustomCurrency(5);
        const log = DataService.getDeletionLog();
        expect(Object.keys(log.people || {})).toEqual(['4']);
        expect(Object.keys(log.customCurrencies || {})).toEqual(['5']);
    });
});

describe('record changed on both devices since the last sync', () => {
    test('newer copy is kept and the other is recorded as a conflict', () => {
        const local = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 150, updatedAt: T.a }] });
        const cloud = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 130, updatedAt: T.b }] }, T.a);
        const m = merge(local, cloud);
        expect(m.data.goals[0].currentSaved).toBe(130);
        const c = conflicts().goals['1'];
        expect(c.concurrent).toBe(true);
        expect(c.cloudSnapshot.currentSaved).toBe(150);
    });
    test('only one side changed since the sync: no conflict', () => {
        const local = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 100, updatedAt: T.before }] });
        const cloud = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 130, updatedAt: T.b }] }, T.a);
        merge(local, cloud);
        expect(conflicts().goals || {}).toEqual({});
    });
    test('never synced before: no conflict (nothing to compare against)', () => {
        store.removeItem('financeApp_lastCloudSync');
        const local = makeBackup({ goals: [{ id: 1, currentSaved: 150, updatedAt: T.a }] });
        const cloud = makeBackup({ goals: [{ id: 1, currentSaved: 130, updatedAt: T.b }] }, T.a);
        merge(local, cloud);
        expect(conflicts().goals || {}).toEqual({});
    });
    test('the conflict survives the next sync until resolved', () => {
        const local = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 150, updatedAt: T.a }] });
        const cloud = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 130, updatedAt: T.b }] }, T.a);
        const m = merge(local, cloud);
        store.setItem('financeApp_lastCloudSync', '2026-01-03T00:00:00.000Z'); // synced since
        merge(m, m);
        expect(conflicts().goals['1'].cloudSnapshot.currentSaved).toBe(150);
    });
    test('the carried conflict clears once the record matches the other version', () => {
        const local = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 150, updatedAt: T.a }] });
        const cloud = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 130, updatedAt: T.b }] }, T.a);
        merge(local, cloud);
        store.setItem('financeApp_lastCloudSync', '2026-01-03T00:00:00.000Z');
        const fixed = makeBackup({ goals: [{ id: 1, name: 'Car', currentSaved: 150, updatedAt: '2026-01-03T01:00:00.000Z' }] });
        merge(fixed, fixed);
        expect(conflicts().goals || {}).toEqual({});
    });
    test('deleted on either device: no conflict', () => {
        const local = makeBackup({ goals: [{ id: 1, currentSaved: 150, updatedAt: T.a }] });
        const cloud = makeBackup({ goals: [{ id: 1, currentSaved: 130, updatedAt: T.b }], _deletionLog: { goals: { 1: T.b } } }, T.a);
        const m = merge(local, cloud);
        expect(m.data.goals).toEqual([]);
        expect(conflicts().goals || {}).toEqual({});
    });
});

describe('Net Worth item history', () => {
    const base = { id: 7, name: 'ISA', type: 'asset' };
    test('a top-up on one device and a valuation on the other are both kept, in date order', () => {
        const topup = { id: 101, type: 'topup', amount: 200, date: '2026-01-02' };
        const val = { id: 102, type: 'value', from: 1000, value: 1500, date: '2026-01-02' };
        const old = { id: 50, type: 'value', from: 900, value: 1000, date: '2025-12-01' };
        const local = makeBackup({ networth: [{ ...base, value: 1200, history: [old, topup], updatedAt: T.a }] });
        const cloud = makeBackup({ networth: [{ ...base, value: 1500, history: [old, val], updatedAt: T.b }] }, T.a);
        const item = merge(local, cloud).data.networth[0];
        expect(item.value).toBe(1500);
        expect(item.history.map(h => h.id)).toEqual([50, 101, 102]);
        const c = conflicts().networth['7'];
        expect(c.concurrent).toBe(true);
        expect(c.cloudSnapshot.value).toBe(1200);
        expect(c.cloudSnapshot.history.map(h => h.id)).toEqual([50, 101, 102]);
    });
    test('history-only difference merges cleanly with no conflict', () => {
        const local = makeBackup({ networth: [{ ...base, value: 1000, history: [{ id: 1, type: 'value', value: 1000, date: '2026-01-01' }], updatedAt: T.a }] });
        const cloud = makeBackup({ networth: [{ ...base, value: 1000, history: [{ id: 2, type: 'value', value: 1000, date: '2026-01-02' }], updatedAt: T.b }] }, T.a);
        const item = merge(local, cloud).data.networth[0];
        expect(item.history.map(h => h.id)).toEqual([1, 2]);
        expect(conflicts().networth || {}).toEqual({});
    });
});
