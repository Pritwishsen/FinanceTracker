const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Bill reminders: 'Off' is stored as 0 days and must survive a save (it used to be
// coerced back to 3 by `parseInt(x) || 3`). A missing value still defaults to 3.
const { DataService, DateUtils, __sandbox } = loadInlineClasses([
    'DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView',
]);

const store = __sandbox.localStorage;
const base = () => ({ name: 'Council tax', amount: '120', currency: 'GBP', frequency: 'Monthly', nextDueDate: DateUtils.today(), categoryId: '', subcategory: '', notes: '', person: 'own' });

beforeEach(() => { store.clear(); });

test('reminder Off (0) is saved as 0', () => {
    expect(DataService.addBill({ ...base(), reminderDaysBefore: 0 }).reminderDaysBefore).toBe(0);
    expect(DataService.addBill({ ...base(), name: 'Water', reminderDaysBefore: '0' }).reminderDaysBefore).toBe(0);
});

test('chip values and existing custom values are kept', () => {
    expect(DataService.addBill({ ...base(), reminderDaysBefore: 7 }).reminderDaysBefore).toBe(7);
    expect(DataService.addBill({ ...base(), name: 'Water', reminderDaysBefore: '5' }).reminderDaysBefore).toBe(5);
});

test('missing reminder still defaults to 3 days', () => {
    expect(DataService.addBill({ ...base(), reminderDaysBefore: undefined }).reminderDaysBefore).toBe(3);
    expect(DataService.addBill({ ...base(), name: 'Water', reminderDaysBefore: '' }).reminderDaysBefore).toBe(3);
});
