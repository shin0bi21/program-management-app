// This suite owns calendar-cell activation and action menus.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildDayPeriod } from '../../utils/periods';
import type { CalendarCellContext } from '../../types';
import Cell from './Cell';

interface TestRow { id: string }
interface TestItem { id: string }

const row: TestRow = { id: 'staff-1' };
const items: TestItem[] = [{ id: 'entry-1' }, { id: 'entry-2' }];
const context: CalendarCellContext<TestRow, TestItem> = {
  row,
  rowIndex: 0,
  period: buildDayPeriod('2026-08-10'),
  items,
};

describe('Cell', () => {
  it('keeps a non-interactive body cell in the grid without adding it to the tab order', () => {
    render(<Cell<TestRow, TestItem> context={context} rowId={row.id} />);

    const cell = screen.getByRole('gridcell');
    expect(cell).not.toHaveAttribute('tabindex');
  });

  it('activates an interactive cell with pointer and keyboard input', () => {
    const onCellClick = vi.fn();
    render(<Cell<TestRow, TestItem>
      context={{ ...context, items: [] }}
      rowId={row.id}
      onCellClick={onCellClick}
    />);

    const cell = screen.getByRole('gridcell', { name: 'Add item for 2026-08-10' });
    fireEvent.click(cell);
    fireEvent.keyDown(cell, { key: 'Enter' });

    expect(onCellClick).toHaveBeenCalledTimes(2);
    expect(onCellClick).toHaveBeenLastCalledWith(expect.objectContaining({ period: context.period }));
  });

  it('opens cell actions instead of emitting the default cell activation', () => {
    const onCellClick = vi.fn();
    const onSelect = vi.fn();
    render(<Cell<TestRow, TestItem>
      context={{ ...context, items: [] }}
      rowId={row.id}
      onCellClick={onCellClick}
      getCellActions={() => [{ id: 'add-task', label: 'Add task', onSelect }]}
    />);

    const cell = screen.getByRole('gridcell', { name: 'Show actions for 2026-08-10' });
    expect(cell).toHaveAttribute('aria-haspopup', 'menu');
    expect(cell).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(cell, { key: ' ' });
    expect(cell).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add task' }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onCellClick).not.toHaveBeenCalled();
  });
});
