const { loadInlineClasses } = require('./helpers/loadInlineClasses');

const { DateUtils } = loadInlineClasses(['DateUtils']);

test('toDateStr formats a Date using its LOCAL fields, never UTC', () => {
    // A Date constructed via new Date(y, m, d) is a local-time instant. If
    // toDateStr ever routed through toISOString()/UTC, this would come back
    // shifted by a day for negative-offset test environments.
    expect(DateUtils.toDateStr(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(DateUtils.toDateStr(new Date(2026, 11, 31))).toBe('2026-12-31');
});

test('today() matches toDateStr(new Date()) regardless of time-of-day', () => {
    expect(DateUtils.today()).toBe(DateUtils.toDateStr(new Date()));
});

test('parseDateStr + toDateStr round-trip a date-only string exactly', () => {
    ['2026-01-01', '2026-02-28', '2026-12-31', '2024-02-29'].forEach(str => {
        expect(DateUtils.toDateStr(DateUtils.parseDateStr(str))).toBe(str);
    });
});

test('parseDateStr never crosses a day boundary the way new Date(str) (UTC midnight) can', () => {
    // This is the actual bug being fixed: new Date('2026-07-09') is UTC midnight,
    // which local getters/setters can misread as the previous day for negative-
    // offset zones. parseDateStr must always report back the exact same
    // calendar fields it was given, independent of the runtime's offset.
    const d = DateUtils.parseDateStr('2026-07-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(9);
});

test('addToDateStr advances by days across a month/year boundary', () => {
    expect(DateUtils.addToDateStr('2026-12-31', { days: 1 })).toBe('2027-01-01');
});

test('addToDateStr advances by months, preserving native day-overflow semantics', () => {
    expect(DateUtils.addToDateStr('2026-06-09', { months: 1 })).toBe('2026-07-09');
    // Jan 31 + 1 month overflows into March under JS's native Date arithmetic
    // (Feb has no 31st) — this fix only removes the UTC/local mismatch, not
    // this pre-existing overflow behavior, so the test pins today's actual output.
    expect(DateUtils.addToDateStr('2026-01-31', { months: 1 })).toBe('2026-03-03');
});

test('addToDateStr handles a leap-day correctly', () => {
    expect(DateUtils.addToDateStr('2024-02-29', { years: 1 })).toBe('2025-03-01');
    expect(DateUtils.addToDateStr('2024-02-29', { days: 1 })).toBe('2024-03-01');
});

test('addToDateStr advances by years', () => {
    expect(DateUtils.addToDateStr('2026-07-09', { years: 1 })).toBe('2027-07-09');
});

test('the whole chain never touches toISOString/UTC (offset-invariance)', () => {
    // Every calendar date, at every hour of that day, must format back to the
    // exact same string — proving the implementation never converts through UTC.
    const day = new Date(2026, 5, 15);
    for (let hour = 0; hour < 24; hour++) {
        const withHour = new Date(2026, 5, 15, hour, 30);
        expect(DateUtils.toDateStr(withHour)).toBe(DateUtils.toDateStr(day));
    }
});
