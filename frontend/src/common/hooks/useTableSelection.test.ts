import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import useTableSelection from './useTableSelection';

describe('useTableSelection', () => {
  it('keeps the selected item synchronized with refreshed row data', () => {
    const first = { id: 'row-1', name: 'Original' };
    const { result, rerender } = renderHook(
      ({ rows }) => useTableSelection(rows),
      { initialProps: { rows: [first] } },
    );

    act(() => result.current.selectItem(first));
    expect(result.current.selectedItem).toEqual(first);

    const refreshed = { id: 'row-1', name: 'Updated' };
    rerender({ rows: [refreshed] });

    expect(result.current.selectedKey).toBe('row-1');
    expect(result.current.selectedItem).toEqual(refreshed);
  });

  it('clears selection when filtering removes the selected row', async () => {
    const row = { id: 'row-1', name: 'Selected' };
    const { result, rerender } = renderHook(
      ({ rows }) => useTableSelection(rows),
      { initialProps: { rows: [row] } },
    );

    act(() => result.current.selectItem(row));
    rerender({ rows: [] });

    expect(result.current.selectedItem).toBeNull();
    await waitFor(() => expect(result.current.selectedKey).toBeNull());
  });
});
