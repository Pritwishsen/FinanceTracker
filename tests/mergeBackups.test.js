const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// mergeBackups is the union step behind every two-device sync path (login merge,
// reconnect, restore-vs-cloud, periodic check). mergeById — the per-collection
// union it's built on — is a private closure, so it's exercised through
// mergeBackups. getBackupTimestamp is the top-level helper mergeBackups calls
// to decide whose scalar settings win.
const { DataService, __sandbox } = loadInlineClasses(['DataService', 'getBackupTimestamp']);

const store = __sandbox.localStorage;

// Every collection mergeBackups unions by id.
const MERGED_COLLECTIONS = [
    'expenses', 'income', 'goals', 'bills', 'recurring', 'debts', 'netWorthHistory',
    'categories', 'assetCategories', 'liabilityCategories', 'networth',
    'bankAccounts', 'transfers', 'reconciliations',
];
// Those the deletion log is applied to (netWorthHistory is append-only, so it's excluded).
const DELETABLE_COLLECTIONS = MERGED_COLLECTIONS.filter(k => k !== 'netWorthHistory');

const T = {
    old: '2026-01-01T10:00:00.000Z',
    mid: '2026-01-02T10:00:00.000Z',
    new: '2026-01-03T10:00:00.000Z',
};

// A realistic backup, shaped like DataService.createBackup() output: every
// collection present as an array and _deletionLog present, so "did the merge add
// anything" comparisons aren't skewed by null-vs-[] normalisation.
const makeBackup = (data = {}, { createdAt = T.mid, userId = 'user-1', ...extra } = {}) => {
    const full = { settings: { currency: 'GBP' }, notifSettings: null, _deletionLog: {} };
    MERGED_COLLECTIONS.forEach(k => { full[k] = []; });
    return { version: '1.0', createdAt, userId, ...extra, data: { ...full, ...data } };
};

const merge = (local, cloud) => DataService.mergeBackups(local, cloud);
const ids = (arr) => arr.map(x => String(x.id)).sort();
const readConflicts = () => JSON.parse(store.getItem('financeApp_syncConflicts') || '{}');

beforeEach(() => store.clear());

// ─────────────────────────────────────────────────────────────────────────────
describe('union of two devices with no conflicts', () => {
    test('records that exist on only one side are all kept', () => {
        const local = makeBackup({ expenses: [{ id: 1, description: 'local only', createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 2, description: 'cloud only', createdAt: T.old }] });
        expect(ids(merge(local, cloud).data.expenses)).toEqual(['1', '2']);
    });

    test('an identical record on both sides appears once', () => {
        const rec = { id: 5, description: 'same', amount: 10, createdAt: T.old };
        const merged = merge(makeBackup({ expenses: [rec] }), makeBackup({ expenses: [{ ...rec }] }));
        expect(merged.data.expenses).toHaveLength(1);
    });

    test.each(MERGED_COLLECTIONS)('%s is unioned by id', collection => {
        const local = makeBackup({ [collection]: [{ id: 1, createdAt: T.old }, { id: 3, createdAt: T.old }] });
        const cloud = makeBackup({ [collection]: [{ id: 2, createdAt: T.old }, { id: 3, createdAt: T.old }] });
        expect(ids(merge(local, cloud).data[collection])).toEqual(['1', '2', '3']);
    });

    test('ids match across string and number types (same record, different serialisation)', () => {
        const local = makeBackup({ expenses: [{ id: 123, description: 'x', createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: '123', description: 'x', createdAt: T.old }] });
        expect(merge(local, cloud).data.expenses).toHaveLength(1);
    });

    test('a side with nothing in a collection (null/missing) merges cleanly with the other', () => {
        const local = makeBackup({ goals: null });
        const cloud = makeBackup({ goals: [{ id: 1, name: 'Holiday', createdAt: T.old }] });
        delete local.data.bills;
        expect(merge(local, cloud).data.goals).toHaveLength(1);
        expect(merge(cloud, local).data.goals).toHaveLength(1);
        expect(merge(local, cloud).data.bills).toEqual([]);
    });

    test('a missing local backup just yields the cloud contents', () => {
        const cloud = makeBackup({ expenses: [{ id: 1, createdAt: T.old }] });
        expect(ids(merge(null, cloud).data.expenses)).toEqual(['1']);
    });

    test('carries over the cloud userId and version', () => {
        const merged = merge(makeBackup({}, { userId: 'local-user' }), makeBackup({}, { userId: 'cloud-user' }));
        expect(merged.userId).toBe('cloud-user');
        expect(merged.version).toBe('1.0');
    });

    test('does not mutate either input backup', () => {
        const local = makeBackup({ expenses: [{ id: 1, description: 'a', createdAt: T.old }, { id: 3, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 1, description: 'b', updatedAt: T.new, createdAt: T.old }, { id: 2, createdAt: T.old }] });
        const before = JSON.stringify([local, cloud]);
        merge(local, cloud);
        expect(JSON.stringify([local, cloud])).toBe(before);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('same-id conflict resolution: the newer timestamp wins', () => {
    const winner = (localRec, cloudRec) =>
        merge(makeBackup({ expenses: [localRec] }), makeBackup({ expenses: [cloudRec] })).data.expenses[0];

    test('newer updatedAt on the local side wins', () => {
        const w = winner({ id: 1, description: 'local edit', updatedAt: T.new, createdAt: T.old }, { id: 1, description: 'cloud', updatedAt: T.mid, createdAt: T.old });
        expect(w.description).toBe('local edit');
    });

    test('newer updatedAt on the cloud side wins', () => {
        const w = winner({ id: 1, description: 'local', updatedAt: T.mid, createdAt: T.old }, { id: 1, description: 'cloud edit', updatedAt: T.new, createdAt: T.old });
        expect(w.description).toBe('cloud edit');
    });

    test('updatedAt takes precedence over createdAt', () => {
        // Local was created later but never edited; cloud was created earlier but edited most recently.
        const w = winner({ id: 1, description: 'local', createdAt: T.mid }, { id: 1, description: 'cloud edited', createdAt: T.old, updatedAt: T.new });
        expect(w.description).toBe('cloud edited');
    });

    test('falls back to createdAt when neither side has updatedAt', () => {
        const w = winner({ id: 1, description: 'local', createdAt: T.old }, { id: 1, description: 'cloud', createdAt: T.new });
        expect(w.description).toBe('cloud');
    });

    test('a record with any timestamp beats one with none', () => {
        const w = winner({ id: 1, description: 'no timestamps' }, { id: 1, description: 'stamped', createdAt: T.old });
        expect(w.description).toBe('stamped');
    });

    test('the winning record is taken whole — fields are not blended across sides', () => {
        const w = winner(
            { id: 1, description: 'local', amount: 10, notes: 'local note', updatedAt: T.new, createdAt: T.old },
            { id: 1, description: 'cloud', amount: 99, tags: ['x'], updatedAt: T.mid, createdAt: T.old },
        );
        expect(w).toEqual({ id: 1, description: 'local', amount: 10, notes: 'local note', updatedAt: T.new, createdAt: T.old });
    });

    test('the same rule applies to non-expense collections (e.g. a renamed category)', () => {
        const local = makeBackup({ categories: [{ id: 1, name: 'Old name', createdAt: T.old }] });
        const cloud = makeBackup({ categories: [{ id: 1, name: 'Renamed', updatedAt: T.new, createdAt: T.old }] });
        expect(merge(local, cloud).data.categories[0].name).toBe('Renamed');
    });

    test('resolution is symmetric: whichever side is "local", the newer edit wins', () => {
        const a = { id: 1, description: 'A', updatedAt: T.new, createdAt: T.old };
        const b = { id: 1, description: 'B', updatedAt: T.mid, createdAt: T.old };
        expect(winner(a, b).description).toBe('A');
        expect(winner(b, a).description).toBe('A');
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('exact-timestamp ties', () => {
    const tie = (localFields, cloudFields) => merge(
        makeBackup({ expenses: [{ id: 1, updatedAt: T.mid, createdAt: T.old, ...localFields }] }),
        makeBackup({ expenses: [{ id: 1, updatedAt: T.mid, createdAt: T.old, ...cloudFields }] }),
    );

    test('local wins a tie, as before', () => {
        expect(tie({ description: 'local' }, { description: 'cloud' }).data.expenses[0].description).toBe('local');
    });

    test('a tie with differing content is recorded as a sync conflict, keeping the cloud side\'s content for review', () => {
        tie({ description: 'local', amount: 10 }, { description: 'cloud', amount: 10 });
        const conflict = readConflicts().expenses['1'];
        expect(conflict).toBeDefined();
        // id/createdAt/updatedAt are meta, not content — they're stripped from the snapshot.
        expect(conflict.cloudSnapshot).toEqual({ description: 'cloud', amount: 10 });
        expect(typeof conflict.detectedAt).toBe('string');
    });

    test('a tie with identical content is not a conflict', () => {
        tie({ description: 'same' }, { description: 'same' });
        expect(readConflicts().expenses).toEqual({});
    });

    test('a differing-content record that is NOT a tie is not a conflict (a clear winner exists)', () => {
        merge(
            makeBackup({ expenses: [{ id: 1, description: 'local', updatedAt: T.new, createdAt: T.old }] }),
            makeBackup({ expenses: [{ id: 1, description: 'cloud', updatedAt: T.mid, createdAt: T.old }] }),
        );
        expect(readConflicts().expenses).toEqual({});
    });

    test('a field present on only one side counts as differing content', () => {
        tie({ notes: 'only local' }, {});
        expect(readConflicts().expenses['1'].cloudSnapshot).toEqual({});
    });

    test('field order within the record does not matter — only content is compared', () => {
        tie({ description: 'x', amount: 5 }, { amount: 5, description: 'x' });
        expect(readConflicts().expenses).toEqual({});
    });

    test('conflicts are tracked per collection and rebuilt fresh on every merge (self-healing)', () => {
        tie({ description: 'local' }, { description: 'cloud' });
        expect(Object.keys(readConflicts().expenses)).toEqual(['1']);
        merge(makeBackup(), makeBackup());
        expect(readConflicts().expenses).toEqual({});
    });

    test('netWorthHistory is never a conflict collection', () => {
        merge(
            makeBackup({ netWorthHistory: [{ id: 1, date: '2026-01-01', netWorth: 1, updatedAt: T.mid }] }),
            makeBackup({ netWorthHistory: [{ id: 1, date: '2026-01-01', netWorth: 2, updatedAt: T.mid }] }),
        );
        expect(readConflicts().netWorthHistory).toBeUndefined();
        expect(readConflicts().expenses).toEqual({});
    });

    test('conflict info stays out of the merged payload that gets uploaded to the cloud', () => {
        const merged = tie({ description: 'local' }, { description: 'cloud' });
        expect(JSON.stringify(merged)).not.toContain('cloudSnapshot');
        expect(merged.data.syncConflicts).toBeUndefined();
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('deletion log', () => {
    test.each(DELETABLE_COLLECTIONS)('a %s record deleted on the cloud side is removed even though local still has it', collection => {
        const local = makeBackup({ [collection]: [{ id: 1, createdAt: T.old }, { id: 2, createdAt: T.old }] });
        const cloud = makeBackup({ [collection]: [{ id: 2, createdAt: T.old }] });
        cloud.data._deletionLog = { [collection]: { 1: T.mid } };
        expect(ids(merge(local, cloud).data[collection])).toEqual(['2']);
    });

    test.each(DELETABLE_COLLECTIONS)('a %s record deleted locally is removed even though the cloud still has it', collection => {
        const local = makeBackup({ [collection]: [{ id: 2, createdAt: T.old }] });
        local.data._deletionLog = { [collection]: { 1: T.mid } };
        const cloud = makeBackup({ [collection]: [{ id: 1, createdAt: T.old }, { id: 2, createdAt: T.old }] });
        expect(ids(merge(local, cloud).data[collection])).toEqual(['2']);
    });

    test('categories are honoured explicitly (DEF-019: they were once missing from the deletion pass)', () => {
        const local = makeBackup({ categories: [{ id: 10, name: 'Gone', createdAt: T.old }, { id: 11, name: 'Kept', createdAt: T.old }] });
        const cloud = makeBackup({ categories: [{ id: 10, name: 'Gone', createdAt: T.old }, { id: 11, name: 'Kept', createdAt: T.old }] });
        cloud.data._deletionLog = { categories: { 10: T.mid }, assetCategories: {}, liabilityCategories: {} };
        expect(ids(merge(local, cloud).data.categories)).toEqual(['11']);
    });

    test('the deletion is matched by id across string/number types', () => {
        const local = makeBackup({ expenses: [{ id: 123, createdAt: T.old }] });
        const cloud = makeBackup();
        cloud.data._deletionLog = { expenses: { '123': T.mid } };
        expect(merge(local, cloud).data.expenses).toEqual([]);
    });

    test('a deletion takes effect even if the other device edited the record afterwards', () => {
        // Current contract: the log is authoritative — it isn't compared with updatedAt.
        const local = makeBackup({ expenses: [{ id: 1, description: 'edited after delete', updatedAt: T.new, createdAt: T.old }] });
        const cloud = makeBackup();
        cloud.data._deletionLog = { expenses: { 1: T.mid } };
        expect(merge(local, cloud).data.expenses).toEqual([]);
    });

    test('deletion logs from both sides are unioned across types', () => {
        const local = makeBackup(); local.data._deletionLog = { expenses: { 1: T.old } };
        const cloud = makeBackup(); cloud.data._deletionLog = { income: { 2: T.mid }, expenses: { 3: T.mid } };
        expect(merge(local, cloud).data._deletionLog).toEqual({
            expenses: { 1: T.old, 3: T.mid },
            income: { 2: T.mid },
        });
    });

    test('when both sides deleted the same id, the later deletion timestamp is kept', () => {
        const local = makeBackup(); local.data._deletionLog = { expenses: { 1: T.new } };
        const cloud = makeBackup(); cloud.data._deletionLog = { expenses: { 1: T.old } };
        expect(merge(local, cloud).data._deletionLog.expenses[1]).toBe(T.new);
        expect(merge(cloud, local).data._deletionLog.expenses[1]).toBe(T.new);
    });

    test('a missing deletion log on either side is treated as empty', () => {
        const local = makeBackup(); delete local.data._deletionLog;
        const cloud = makeBackup(); delete cloud.data._deletionLog;
        expect(merge(local, cloud).data._deletionLog).toEqual({});
    });

    test('unrelated records are untouched by other ids in the log', () => {
        const local = makeBackup({ expenses: [{ id: 1, createdAt: T.old }, { id: 2, createdAt: T.old }, { id: 3, createdAt: T.old }] });
        const cloud = makeBackup(); cloud.data._deletionLog = { expenses: { 2: T.mid }, income: { 1: T.mid } };
        expect(ids(merge(local, cloud).data.expenses)).toEqual(['1', '3']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('netWorthHistory', () => {
    test('snapshots from both devices are unioned and put back in date order', () => {
        const local = makeBackup({ netWorthHistory: [{ id: 3, date: '2026-03-01', netWorth: 30 }, { id: 1, date: '2026-01-01', netWorth: 10 }] });
        const cloud = makeBackup({ netWorthHistory: [{ id: 2, date: '2026-02-01', netWorth: 20 }] });
        expect(merge(local, cloud).data.netWorthHistory.map(e => e.date)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    });

    test('snapshots without an id cannot be matched across devices and are dropped', () => {
        // Guards the comment in autoSaveNetWorthSnapshot: id is REQUIRED on every entry.
        const local = makeBackup({ netWorthHistory: [{ date: '2026-01-01', netWorth: 10 }] });
        const cloud = makeBackup({ netWorthHistory: [{ id: 2, date: '2026-02-01', netWorth: 20 }] });
        expect(merge(local, cloud).data.netWorthHistory.map(e => e.id)).toEqual([2]);
    });

    test('is not touched by the deletion log', () => {
        const local = makeBackup({ netWorthHistory: [{ id: 1, date: '2026-01-01', netWorth: 10 }] });
        const cloud = makeBackup(); cloud.data._deletionLog = { netWorthHistory: { 1: T.mid } };
        expect(merge(local, cloud).data.netWorthHistory).toHaveLength(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('records with no id', () => {
    test('are dropped from the merge on either side (they cannot be matched)', () => {
        const local = makeBackup({ expenses: [{ description: 'local no id', createdAt: T.old }, { id: 1, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ description: 'cloud no id', createdAt: T.old }, { id: 2, createdAt: T.old }] });
        expect(ids(merge(local, cloud).data.expenses)).toEqual(['1', '2']);
    });

    test('null entries in a collection are ignored rather than crashing the merge', () => {
        const local = makeBackup({ expenses: [null, { id: 1, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 2, createdAt: T.old }, null] });
        expect(ids(merge(local, cloud).data.expenses)).toEqual(['1', '2']);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('scalar settings blobs: the newer backup wins', () => {
    test('when the local backup is newer, its settings and notifSettings win', () => {
        const local = makeBackup({ settings: { currency: 'USD' }, notifSettings: { on: true } }, { createdAt: T.new });
        const cloud = makeBackup({ settings: { currency: 'GBP' }, notifSettings: { on: false } }, { createdAt: T.mid });
        const merged = merge(local, cloud);
        expect(merged.data.settings).toEqual({ currency: 'USD' });
        expect(merged.data.notifSettings).toEqual({ on: true });
    });

    test('when the cloud backup is newer, its settings win', () => {
        const local = makeBackup({ settings: { currency: 'USD' } }, { createdAt: T.mid });
        const cloud = makeBackup({ settings: { currency: 'GBP' } }, { createdAt: T.new });
        expect(merge(local, cloud).data.settings).toEqual({ currency: 'GBP' });
    });

    test('a timestamp tie goes to the cloud', () => {
        const local = makeBackup({ settings: { currency: 'USD' } }, { createdAt: T.mid });
        const cloud = makeBackup({ settings: { currency: 'GBP' } }, { createdAt: T.mid });
        expect(merge(local, cloud).data.settings).toEqual({ currency: 'GBP' });
    });

    test('a newer local backup with no settings does not blank out the cloud\'s', () => {
        const local = makeBackup({ settings: null }, { createdAt: T.new });
        const cloud = makeBackup({ settings: { currency: 'GBP' } }, { createdAt: T.mid });
        expect(merge(local, cloud).data.settings).toEqual({ currency: 'GBP' });
    });

    test('freshness uses the cloud\'s server modified time over its own (possibly wrong) client clock', () => {
        // The cloud backup's client clock claims it's from 2099 (skewed device), but the
        // provider's server timestamp says it was really uploaded before the local backup.
        const local = makeBackup({ settings: { currency: 'USD' } }, { createdAt: T.new });
        const cloud = makeBackup({ settings: { currency: 'GBP' } }, { createdAt: '2099-01-01T00:00:00.000Z', _serverModifiedTime: T.mid });
        expect(merge(local, cloud).data.settings).toEqual({ currency: 'USD' });
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('createdAt re-stamping (DEF-015 "merge storm" regression guard)', () => {
    test('a no-op merge keeps the cloud backup\'s createdAt instead of stamping "now"', () => {
        // Local has nothing the cloud lacks. Re-stamping here made the cloud copy look newer
        // to the other device, which re-merged on its very next edit, forever.
        const shared = [{ id: 1, description: 'a', createdAt: T.old }, { id: 2, description: 'b', createdAt: T.old }];
        const local = makeBackup({ expenses: shared }, { createdAt: T.old });
        const cloud = makeBackup({ expenses: shared.map(e => ({ ...e })) }, { createdAt: T.mid });
        expect(merge(local, cloud).createdAt).toBe(T.mid);
    });

    test('a local subset of the cloud is also a no-op', () => {
        const local = makeBackup({ expenses: [{ id: 1, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 1, createdAt: T.old }, { id: 2, createdAt: T.old }] }, { createdAt: T.mid });
        expect(merge(local, cloud).createdAt).toBe(T.mid);
    });

    test('a merge that adds a local-only record stamps a fresh createdAt', () => {
        const local = makeBackup({ expenses: [{ id: 9, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 1, createdAt: T.old }] }, { createdAt: T.mid });
        const before = Date.now();
        const stamped = new Date(merge(local, cloud).createdAt).getTime();
        expect(stamped).toBeGreaterThanOrEqual(before);
        expect(stamped).toBeGreaterThan(new Date(T.mid).getTime());
    });

    test('a merge where local has a newer edit of a shared record stamps a fresh createdAt', () => {
        const local = makeBackup({ expenses: [{ id: 1, description: 'edited', updatedAt: T.new, createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 1, description: 'orig', createdAt: T.old }] }, { createdAt: T.mid });
        expect(new Date(merge(local, cloud).createdAt).getTime()).toBeGreaterThan(new Date(T.mid).getTime());
    });

    test('a merge that only applies a deletion also counts as a change', () => {
        const local = makeBackup(); local.data._deletionLog = { expenses: { 1: T.mid } };
        const cloud = makeBackup({ expenses: [{ id: 1, createdAt: T.old }] }, { createdAt: T.mid });
        expect(new Date(merge(local, cloud).createdAt).getTime()).toBeGreaterThan(new Date(T.mid).getTime());
    });

    test('merging the result back with the cloud is a no-op (idempotent — the two-device loop terminates)', () => {
        const local = makeBackup({ expenses: [{ id: 1, description: 'local', createdAt: T.old }] });
        const cloud = makeBackup({ expenses: [{ id: 2, description: 'cloud', createdAt: T.old }] }, { createdAt: T.mid });
        const first = merge(local, cloud);
        // The cloud now holds `first`; the local device re-merges against it.
        const second = merge(local, first);
        expect(second.data).toEqual(first.data);
        expect(second.createdAt).toBe(first.createdAt);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('convergence', () => {
    test('both devices end up with the same set of records regardless of merge direction', () => {
        const a = makeBackup({
            expenses: [{ id: 1, description: 'A1', createdAt: T.old }, { id: 3, description: 'A3 newer', updatedAt: T.new, createdAt: T.old }],
            income: [{ id: 10, source: 'A', createdAt: T.old }],
        });
        const b = makeBackup({
            expenses: [{ id: 2, description: 'B2', createdAt: T.old }, { id: 3, description: 'B3 older', updatedAt: T.mid, createdAt: T.old }],
            income: [{ id: 11, source: 'B', createdAt: T.old }],
        });
        const ab = merge(a, b).data, ba = merge(b, a).data;
        expect(ids(ab.expenses)).toEqual(ids(ba.expenses));
        expect(ids(ab.income)).toEqual(ids(ba.income));
        expect(ab.expenses.find(e => e.id === 3).description).toBe('A3 newer');
        expect(ba.expenses.find(e => e.id === 3).description).toBe('A3 newer');
    });
});
