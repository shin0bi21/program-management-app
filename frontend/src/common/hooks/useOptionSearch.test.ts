import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useOptionSearch } from './useOptionSearch';

const options = [{ id: 'hidden', name: 'Toronto' }, { id: 'toronto', name: 'London' }];

it('filters visible labels case-insensitively, retains option data, and clears without mutating options', () => {
  const { result } = renderHook(() => useOptionSearch(options));

  act(() => result.current.setSearch('RON'));
  expect(result.current.matches).toEqual([options[0]]);
  expect(result.current.matches[0]).toBe(options[0]);

  act(() => result.current.setSearch('hidden'));
  expect(result.current.matches).toEqual([]);

  act(() => result.current.setSearch(''));
  expect(result.current.matches).toBe(options);
});

it('uses current options and bypasses filtering when disabled', () => {
  const { result, rerender } = renderHook(
    ({ rows, enabled }) => useOptionSearch(rows, enabled),
    { initialProps: { rows: options, enabled: true } },
  );

  act(() => result.current.setSearch('Toronto'));
  rerender({ rows: [options[1]], enabled: true });
  expect(result.current.matches).toEqual([]);

  rerender({ rows: options, enabled: false });
  expect(result.current.matches).toBe(options);
});
