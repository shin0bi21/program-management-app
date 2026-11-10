// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareListSortValues, hasMisplacedListRows, type ListOrdering, type ListSortValue } from './listOrdering';

describe('list ordering', () => {
  it.each<[ListSortValue, ListSortValue]>([
    [2, 10], ['10', '2'], ['alpha', 'beta'], ['a b', 'a-b'], ['z', 'ä'], ['\uE000', '😀'], [false, true],
    [new Date('2026-01-01'), new Date('2026-02-01')], ['', null],
  ])('compares %s before %s using its value type', (left, right) => {
    expect(compareListSortValues(left, right)).toBeLessThan(0);
    expect(compareListSortValues(right, left)).toBeGreaterThan(0);
  });

  it('treats equivalent dates and scalar values equally', () => {
    expect(compareListSortValues(new Date('2026-01-01'), new Date('2026-01-01'))).toBe(0);
    expect(compareListSortValues(3, 3)).toBe(0);
  });

  it.each(['asc', 'desc'] as const)('checks both neighbors and durable ID ties in %s order', direction => {
    const ordering: ListOrdering<{ id: string; value: number }> = { direction, getValue: row => row.value };
    const rows = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }, { id: 'c', value: 3 }];
    if (direction === 'desc') rows.reverse();
    const edited = new Set(['b']);
    expect(hasMisplacedListRows(rows, edited, ordering)).toBe(false);
    expect(hasMisplacedListRows(rows.map(row => row.id === 'b' ? { ...row, value: 0 } : row), edited, ordering)).toBe(true);
    expect(hasMisplacedListRows(rows.map(row => row.id === 'b' ? { ...row, value: 4 } : row), edited, ordering)).toBe(true);
    expect(hasMisplacedListRows(rows.map(row => ({ ...row, value: 2 })), edited, ordering)).toBe(false);
  });

  it('detects a newly equal value in the wrong durable ID position', () => {
    const rows = [{ id: 'b', value: 2 }, { id: 'a', value: 2 }];
    expect(hasMisplacedListRows(rows, new Set(['b']), { direction: 'asc', getValue: row => row.value })).toBe(true);
    expect(hasMisplacedListRows([...rows].reverse(), new Set(['b']), { direction: 'desc', getValue: row => row.value })).toBe(true);
  });

  it.each(['asc', 'desc'] as const)('keeps nulls last and detects edits across the null boundary in %s order', direction => {
    const ordering: ListOrdering<{ id: string; value: number | null }> = { direction, getValue: row => row.value };
    const populated = [{ id: 'a', value: 1 }, { id: 'b', value: 2 }];
    const missing = [{ id: 'c', value: null }, { id: 'd', value: null }];
    if (direction === 'desc') {
      populated.reverse();
      missing.reverse();
    }
    const rows = [...populated, ...missing];
    const editedIds = new Set(rows.map(row => row.id));

    expect(hasMisplacedListRows(rows, editedIds, ordering)).toBe(false);
    expect(hasMisplacedListRows(rows.map((row, index) => index === 0 ? { ...row, value: null } : row), editedIds, ordering)).toBe(true);
    expect(hasMisplacedListRows(rows.map((row, index) => index === rows.length - 1 ? { ...row, value: 3 } : row), editedIds, ordering)).toBe(true);
    expect(hasMisplacedListRows([...populated, ...missing.reverse()], editedIds, ordering)).toBe(true);
  });

  it('does not infer unseen neighbors or inspect pairs without an edited row', () => {
    const ordering = { direction: 'asc' as const, getValue: (row: { value: number }) => row.value };
    expect(hasMisplacedListRows([{ id: 'a', value: 9 }], new Set(['a']), ordering)).toBe(false);
    expect(hasMisplacedListRows([{ id: 'a', value: 9 }, { id: 'b', value: 1 }], new Set(), ordering)).toBe(false);
  });
});
