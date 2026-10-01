const { loadInlineClasses } = require('./helpers/loadInlineClasses');

const { spWithFundingTopups, spAssetValueAt, spAssetOpening, spGrowthCalc, spInvestedEntries } =
    loadInlineClasses(['DateUtils', 'spAssetValueBefore', 'spAssetValueAt', 'spAssetOpening', 'spGrowthCalc', 'spInvestedEntries', 'spWithFundingTopups']);

// Asset opened 2025-01-10 for 1000 (funded from a bank account), topped up 500 on
// 2025-06-15 before assets kept a history (transfer only), topped up 200 on 2026-09-26
// after (history + transfer), then revalued 1700 → 1900.
const ITEM_ID = 1736500000000;
const item = {
    id: ITEM_ID, type: 'asset', name: 'Index Fund', currency: 'GBP', value: 1900, openDate: '2025-01-10',
    history: [
        { id: 1, type: 'topup', amount: 200, date: '2026-09-26' },
        { id: 2, type: 'value', from: 1700, value: 1900, date: '2026-09-27' }
    ]
};
const transfers = [
    { id: ITEM_ID + 40, date: '2025-01-10', toAssetId: ITEM_ID, toAmount: 1000 },           // opening funding
    { id: ITEM_ID + 9e9, date: '2025-06-15', toAssetId: ITEM_ID, toAmount: 500 },           // pre-history top-up
    { id: ITEM_ID + 5e10, date: '2026-09-26', toAssetId: ITEM_ID, toAmount: 200 },          // already in history
    { id: ITEM_ID + 6e10, date: '2026-09-28', toAssetId: 'cash-own-GBP', toAmount: 50, isCashWithdrawal: true },
    { id: ITEM_ID + 7e10, date: '2026-09-28', toAssetId: 999, toAmount: 75 }                 // another asset
];

test('adds only the unmatched, non-opening funding transfer as a top-up', () => {
    const [out] = spWithFundingTopups([item], transfers);
    const topups = out.history.filter(h => h.type === 'topup').map(h => h.date + ':' + h.amount).sort();
    expect(topups).toEqual(['2025-06-15:500', '2026-09-26:200']);
    expect(item.history).toHaveLength(2); // stored item untouched
});

test('value history now reflects the old top-up', () => {
    const [out] = spWithFundingTopups([item], transfers);
    expect(spAssetOpening(out)).toBe(1000);
    expect(spAssetValueAt(out, '2025-06-14')).toBe(1000);
    expect(spAssetValueAt(out, '2025-06-15')).toBe(1500);
    expect(spAssetValueAt(out, '2026-09-26')).toBe(1700);
    expect(spAssetValueAt(out, '2026-09-27')).toBe(1900);
});

test('growth for the quarter counts the old top-up as money added, not growth', () => {
    const [out] = spWithFundingTopups([item], transfers);
    const c = spGrowthCalc([out], { from: '2025-04-01', to: '2025-06-30' }, v => v);
    expect(c.chg).toBe(500);
    expect(c.added).toBe(500);
    expect(c.growth).toBe(0);
});

test('Invested lists the old top-up once and never double counts', () => {
    const [out] = spWithFundingTopups([item], transfers);
    const rows = spInvestedEntries([out], () => true).map(r => r.kind + ':' + r.date + ':' + r.amount);
    expect(rows.sort()).toEqual(['New asset:2025-01-10:1000', 'Top-up:2025-06-15:500', 'Top-up:2026-09-26:200']);
});

test('items with no funding transfers pass through unchanged', () => {
    const other = { id: 5, type: 'asset', value: 10, history: [] };
    expect(spWithFundingTopups([other], transfers)[0]).toBe(other);
});
