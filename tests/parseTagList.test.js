const { loadInlineClasses } = require('./helpers/loadInlineClasses');

// Tags column in Bulk Upload: same rules as the tag chip input.
const { parseTagList } = loadInlineClasses(['parseTagList']);

test('splits on ;, trims, lowercases and drops duplicates and blanks', () => {
    expect(parseTagList(' Weekly Shop ; family;;FAMILY ; ')).toEqual({ tags: ['weekly shop', 'family'], error: null });
});

test('empty or missing cell gives no tags', () => {
    expect(parseTagList('')).toEqual({ tags: [], error: null });
    expect(parseTagList(undefined)).toEqual({ tags: [], error: null });
});

test('a tag longer than 30 characters is an error', () => {
    expect(parseTagList('ok;' + 'x'.repeat(31)).error).toBe('Tags must be 30 characters or fewer');
    expect(parseTagList('x'.repeat(30)).error).toBeNull();
});

test('more than 10 tags is an error, worded for the record type', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => 't' + i).join(';');
    expect(parseTagList(eleven, 'income').error).toBe('Maximum 10 tags allowed per income');
    expect(parseTagList(eleven.split(';').slice(0, 10).join(';')).tags).toHaveLength(10);
});
