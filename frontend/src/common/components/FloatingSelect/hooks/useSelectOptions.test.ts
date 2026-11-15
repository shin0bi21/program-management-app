import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useSelectOptions } from './useSelectOptions';

const options = [
  { id: 'one', name: 'School One' },
  { id: 'two', name: 'School Two' },
];

it('starts at the selected choice, resets navigation on search, and wraps through matches', () => {
  const { result } = renderHook(() => useSelectOptions({ id: 'school', value: 'two', options }));
  expect(result.current.activeOption).toBe(options[1]);

  act(() => result.current.changeSearch('School'));
  expect(result.current.activeOption).toBe(options[0]);
  act(() => result.current.moveActiveOption(-1));
  expect(result.current.activeOption).toBe(options[1]);
  act(() => result.current.moveActiveOption(1));
  expect(result.current.activeOption).toBe(options[0]);
});

it('drops an unavailable highlight when choices change and handles no matches', () => {
  const { result, rerender } = renderHook(
    ({ rows }) => useSelectOptions({ id: 'school', value: 'two', options: rows }),
    { initialProps: { rows: options } },
  );
  rerender({ rows: [options[0]] });
  expect(result.current.activeOption).toBe(options[0]);

  act(() => result.current.changeSearch('missing'));
  act(() => result.current.moveActiveOption(1));
  expect(result.current.activeOption).toBeUndefined();
  expect(result.current.activeId).toBeUndefined();
});
