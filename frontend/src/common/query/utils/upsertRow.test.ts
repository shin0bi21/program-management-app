import { describe, expect, it } from 'vitest';
import upsertRow from './upsertRow';

describe('upsertRow', () => {
  it('replaces an existing row without changing its position', () => {
    const secondRow = { id: 'row-2', name: 'Second' };

    const result = upsertRow([
      { id: 'row-1', name: 'First' },
      secondRow,
    ], { id: 'row-1', name: 'Updated' });

    expect(result).toEqual([
      { id: 'row-1', name: 'Updated' },
      secondRow,
    ]);
    expect(result[1]).toBe(secondRow);
  });

  it('appends a row that is not already in the collection', () => {
    expect(upsertRow([], { id: 'row-1', name: 'New' })).toEqual([
      { id: 'row-1', name: 'New' },
    ]);
  });
});
