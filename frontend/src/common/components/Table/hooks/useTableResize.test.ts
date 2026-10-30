import { act, renderHook } from '@testing-library/react';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import useTableResize from './useTableResize';

function setup() {
  const commit = vi.fn();
  const viewport = document.createElement('div');
  const cell = document.createElement('th');
  const button = document.createElement('button');
  cell.append(button);
  viewport.append(cell);
  const { result, unmount } = renderHook(() => {
    const resize = useTableResize(commit);
    const table = useReactTable({
      data: [], columns: [{ id: 'name', size: 150 }],
      getCoreRowModel: getCoreRowModel(), columnResizeMode: 'onEnd',
      state: { columnSizingInfo: resize.info },
      onColumnSizingInfoChange: resize.onSizingInfoChange,
      onColumnSizingChange: () => { resize.commitResize(); },
    });
    return { resize, header: table.getHeaderGroups()[0].headers[0] };
  });
  act(() => result.current.resize.startResize(result.current.header, {
    type: 'mousedown', button: 0, clientX: 150, currentTarget: button,
  } as MouseEvent<HTMLButtonElement>, { name: 240, hidden: 280 }, viewport));

  return { result, commit, unmount, viewport };
}

describe('useTableResize', () => {
  it('commits from captured geometry and includes scrolling since the gesture began', () => {
    const { commit, viewport } = setup();
    act(() => document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 180 })));
    expect(commit).not.toHaveBeenCalled();

    viewport.scrollLeft = 20;
    act(() => viewport.dispatchEvent(new Event('scroll')));
    act(() => document.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 180 })));

    expect(commit).toHaveBeenCalledExactlyOnceWith({ name: 290, hidden: 280 });
  });

  it.each(['escape', 'blur', 'touchcancel', 'unmount'])('discards %s and removes native drag listeners', reason => {
    const { commit, result, unmount } = setup();
    act(() => {
      if (reason === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      if (reason === 'blur') window.dispatchEvent(new Event('blur'));
      if (reason === 'touchcancel') document.dispatchEvent(new Event('touchcancel'));
      if (reason === 'unmount') unmount();
      document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 250 }));
      document.dispatchEvent(new window.MouseEvent('mouseup', { clientX: 250 }));
    });

    expect(commit).not.toHaveBeenCalled();
    if (reason !== 'unmount') {
      expect(result.current.resize.guide).toBeUndefined();
      expect(result.current.resize.info.isResizingColumn).toBe(false);
    }
  });
});
