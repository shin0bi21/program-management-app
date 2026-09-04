import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import useTableNavigation from './useTableNavigation';

interface Row {
  id: string;
}

const rows: Row[] = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];

function makeWrapper() {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<table><tbody>${rows
    .map((row, index) => `<tr class="${row.id === 'two' ? 'table-row--selected' : ''}" data-table-row-index="${index}" tabindex="-1"><td>${row.id}</td></tr>`)
    .join('')}</tbody></table>`;
  document.body.append(wrapper);
  return wrapper;
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('useTableNavigation', () => {
  it('uses the selected row as the tab stop and falls back to the first row', () => {
    const wrapper = makeWrapper();
    const selected = renderHook(() => useTableNavigation({
      data: rows,
      keyExtractor: row => row.id,
      selectedKey: 'two',
      scrollToSelected: false,
      wrapperRef: { current: wrapper },
    }));
    const missing = renderHook(() => useTableNavigation({
      data: rows,
      keyExtractor: row => row.id,
      selectedKey: 'missing',
      scrollToSelected: false,
      wrapperRef: { current: wrapper },
    }));

    expect(selected.result.current.tabbableIndex).toBe(1);
    expect(missing.result.current.tabbableIndex).toBe(0);
  });

  it('selects and focuses bounded destinations for arrow, Home, and End navigation', () => {
    const wrapper = makeWrapper();
    const onRowSelect = vi.fn();
    const { result } = renderHook(() => useTableNavigation({
      data: rows,
      keyExtractor: row => row.id,
      selectedKey: 'one',
      scrollToSelected: false,
      onRowSelect,
      wrapperRef: { current: wrapper },
    }));

    act(() => result.current.navigateRows(0, 'ArrowDown'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows[1]);
    expect(wrapper.querySelector('[data-table-row-index="1"]')).toHaveFocus();

    act(() => result.current.navigateRows(1, 'End'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows[2]);
    expect(wrapper.querySelector('[data-table-row-index="2"]')).toHaveFocus();

    act(() => result.current.navigateRows(2, 'Home'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows[0]);
    expect(wrapper.querySelector('[data-table-row-index="0"]')).toHaveFocus();

    act(() => result.current.navigateRows(0, 'ArrowUp'));
    expect(onRowSelect).toHaveBeenLastCalledWith(rows[0]);
  });

  it('scrolls each selected key once and permits it again after selection is cleared', () => {
    const wrapper = makeWrapper();
    const selectedRow = wrapper.querySelector('.table-row--selected') as HTMLElement;
    const scrollIntoView = vi.fn();
    selectedRow.scrollIntoView = scrollIntoView;
    const { rerender } = renderHook(
      ({ data, selectedKey }) => useTableNavigation({
        data,
        keyExtractor: row => row.id,
        selectedKey,
        scrollToSelected: true,
        wrapperRef: { current: wrapper },
      }),
      { initialProps: { data: rows.slice(0, 2), selectedKey: 'two' as string | null } },
    );

    expect(scrollIntoView).toHaveBeenCalledOnce();
    rerender({ data: rows, selectedKey: 'two' });
    expect(scrollIntoView).toHaveBeenCalledOnce();

    rerender({ data: rows, selectedKey: null });
    rerender({ data: rows, selectedKey: 'two' });
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });
});
