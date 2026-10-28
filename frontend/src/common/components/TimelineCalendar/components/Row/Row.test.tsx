// This suite owns row item activation, selection, and resize-handle keyboard wiring.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../../types';
import Item from '../Item/Item';
import Row from './Row';

const period: CalendarPeriod = {
  key: '2026-08-19',
  start: new Date(2026, 7, 19),
  end: new Date(2026, 7, 20),
};

describe('Row', () => {
  it('owns activation when the nested shared item control is clicked', () => {
    const onItemActivate = vi.fn();
    const onRowSelect = vi.fn();
    const item = { id: 'task-1', date: period.key };
    render(
      <Row
        row={{ id: 'staff-1' }}
        rowId="staff-1"
        rowIndex={0}
        items={[item]}
        getItemRange={value => ({ start: value.date, end: value.date })}
        periods={[period]}
        leadingPeriodWidth={0}
        gridColumns="100px 0 145px"
        rowHeight={80}
        getItemId={value => value.id}
        renderRow={() => 'Staff member'}
        selected={false}
        onRowSelect={onRowSelect}
        buildItem={() => <Item
          id={item.id}
          ariaLabel="Prepare workshop"
          summary="Prepare workshop"
          detailTitle="Prepare workshop"
          details={[]}
        />}
        onItemActivate={onItemActivate}
        itemResizeEnabled={false}
        onItemResizePointerDown={vi.fn()}
        onItemResizeKeyDown={vi.fn()}
        suppressResizeClickRef={{ current: false }}
        itemMoveEnabled={false}
        onItemMovePointerDown={vi.fn()}
        suppressMoveClickRef={{ current: false }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prepare workshop' }));

    expect(onRowSelect).toHaveBeenCalledWith({ id: 'staff-1' });
    expect(onItemActivate).toHaveBeenCalledWith({
      row: { id: 'staff-1' },
      data: item,
      range: { start: period.key, end: period.key },
    });
  });

  it('starts one-period item movement with the canonical range', () => {
    const onItemMovePointerDown = vi.fn();
    render(
      <Row
        row={{ id: 'staff-1' }}
        rowId="staff-1"
        rowIndex={0}
        items={[{ id: 'task-1', date: period.key }]}
        getItemRange={item => ({ start: item.date, end: item.date })}
        periods={[period]}
        leadingPeriodWidth={0}
        gridColumns="100px 0 145px"
        rowHeight={80}
        getItemId={item => item.id}
        renderRow={() => 'Staff member'}
        selected={false}
        buildItem={() => <button type="button">Task item</button>}
        getItemCapabilities={() => ({ draggable: true })}
        itemResizeEnabled={false}
        onItemResizePointerDown={vi.fn()}
        onItemResizeKeyDown={vi.fn()}
        suppressResizeClickRef={{ current: false }}
        itemMoveEnabled
        onItemMovePointerDown={onItemMovePointerDown}
        suppressMoveClickRef={{ current: false }}
      />,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Task item' }).parentElement!, {
      pointerId: 10,
      button: 0,
      clientX: 140,
      clientY: 70,
    });

    expect(onItemMovePointerDown).toHaveBeenCalledWith(expect.objectContaining({
      pointerId: 10,
    }), {
      row: { id: 'staff-1' },
      item: { id: 'task-1', date: period.key },
      range: { start: period.key, end: period.key },
    });
  });
});
