const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Goal names are unique per owner, not across all participants.
const { DataService, __sandbox } = loadInlineClasses(['DateUtils', 'CurrencyService', 'DataService', 'matchesActiveView']);
const store = __sandbox.localStorage;
const goal = (overrides = {}) => ({ name: 'Holiday', targetAmount: 1000, currency: 'GBP', owner: 'own', ...overrides });

beforeEach(() => { store.clear(); });

test('two different people can each have a goal with the same name', () => {
    DataService.addGoal(goal({ owner: 'own' }));
    expect(() => DataService.addGoal(goal({ owner: 'Priya' }))).not.toThrow();
    expect(DataService.getGoals().map(g => g.owner).sort()).toEqual(['Priya', 'own']);
});

test('the same person cannot have two goals with the same name (case and spaces ignored)', () => {
    DataService.addGoal(goal({ owner: 'Priya' }));
    expect(() => DataService.addGoal(goal({ owner: 'Priya', name: '  holiday ' }))).toThrow('This person already has a goal with this name');
});

test("owner '' and 'own' are treated as the same person", () => {
    DataService.addGoal(goal({ owner: 'own' }));
    expect(() => DataService.addGoal(goal({ owner: '' }))).toThrow();
});

test('goalNameTaken ignores the goal being edited', () => {
    const g = DataService.addGoal(goal({ owner: 'own' }));
    expect(DataService.goalNameTaken('Holiday', 'own', g.id)).toBe(false);
    expect(DataService.goalNameTaken('Holiday', 'own')).toBe(true);
    expect(DataService.goalNameTaken('Holiday', 'Priya')).toBe(false);
});
