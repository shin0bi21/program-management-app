import type { KeyboardEvent, MouseEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { buildDayPeriod } from '../../../../utils/periods';
import useCellActions from './useCellActions';

const menu = vi.hoisted(() => ({ openAtPoint: vi.fn(), toggle: vi.fn(), close: vi.fn() }));
vi.mock('../../../../../FloatingMenu/hooks/useFloatingMenu', () => ({ useFloatingMenu: () => menu }));

const context = {
  row: { id: 'staff-1' }, rowIndex: 0,
  period: buildDayPeriod('2026-08-10'), items: [],
};
beforeEach(() => vi.clearAllMocks());

it('ignores unrelated keys and bubbled keyboard events before activating the latest cell context', () => {
  const onCellClick = vi.fn();
  const { result, rerender } = renderHook(({ value }) => useCellActions({ context: value, onCellClick }), {
    initialProps: { value: context },
  });
  const cell = document.createElement('div');
  const child = document.createElement('button');
  const preventDefault = vi.fn();
  const event = (key: string, target: HTMLElement) => ({
    key, target, currentTarget: cell, preventDefault,
  } as unknown as KeyboardEvent<HTMLDivElement>);

  act(() => result.current.handleKeyDown(event('ArrowRight', cell)));
  act(() => result.current.handleKeyDown(event('Enter', child)));
  expect(onCellClick).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();

  const nextContext = { ...context, row: { id: 'staff-2' } };
  rerender({ value: nextContext });
  act(() => result.current.handleKeyDown(event('Enter', cell)));
  expect(onCellClick).toHaveBeenCalledWith(nextContext);
  expect(preventDefault).toHaveBeenCalledOnce();
});

it('anchors pointer actions and closes the menu before selecting an action', () => {
  const order: string[] = [];
  menu.close.mockImplementation(() => order.push('close'));
  const action = { id: 'add', label: 'Add item', onSelect: vi.fn(() => order.push('select')) };
  const onCellClick = vi.fn();
  const { result } = renderHook(() => useCellActions({ context, onCellClick, getCellActions: () => [action] }));
  act(() => result.current.handleClick({ clientX: 100, clientY: 200 } as MouseEvent<HTMLDivElement>));
  expect(menu.openAtPoint).toHaveBeenCalledWith(100, 200);
  expect(onCellClick).not.toHaveBeenCalled();

  const stopPropagation = vi.fn();
  act(() => result.current.selectAction({ stopPropagation } as unknown as MouseEvent<HTMLButtonElement>, action));
  expect(stopPropagation).toHaveBeenCalledOnce();
  expect(order).toEqual(['close', 'select']);
});
