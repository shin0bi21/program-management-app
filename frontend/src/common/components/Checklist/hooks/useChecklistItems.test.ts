import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useChecklistItems } from './useChecklistItems';

const options = Array.from({ length: 63 }, (_, index) => ({ id: String(index), name: `Choice ${index + 1}` }));

it('reveals batches of 25 and stops at the available matches', () => {
  const { result } = renderHook(() => useChecklistItems({ options, dynamicItems: true, searchEnabled: true }));
  expect(result.current.items).toHaveLength(25);

  act(() => result.current.loadMoreItems());
  expect(result.current.items).toHaveLength(50);

  act(() => result.current.loadMoreItems());
  expect(result.current.items).toHaveLength(63);
  expect(result.current.hasMoreItems).toBe(false);
});

it('searches beyond revealed items and resets the batch when searching or clearing', () => {
  const { result } = renderHook(() => useChecklistItems({ options, dynamicItems: true, searchEnabled: true }));

  act(() => result.current.loadMoreItems());
  act(() => result.current.setSearch('CHOICE 63'));
  expect(result.current.items).toEqual([options[62]]);

  act(() => result.current.setSearch(''));
  expect(result.current.items).toHaveLength(25);
});

it('handles option replacement and switching incremental rendering', () => {
  const { result, rerender } = renderHook(
    props => useChecklistItems(props),
    { initialProps: { options, dynamicItems: true, searchEnabled: false } },
  );

  expect(result.current.items).toHaveLength(25);

  rerender({ options, dynamicItems: false, searchEnabled: false });
  expect(result.current.items).toHaveLength(63);

  rerender({ options: options.slice(0, 3), dynamicItems: true, searchEnabled: false });
  expect(result.current.items).toHaveLength(3);
  expect(result.current.hasMoreItems).toBe(false);

});
