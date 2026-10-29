import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
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

const fixtureTarget = { row: { id: 'staff-1' }, data: { id: 'task-1', date: '2026-08-19' }, range: { start: '2026-08-19', end: '2026-08-19' } };

describe('Row', () => {
  it.each([
    ['2026-08-18', '2026-08-19', true, false],
    ['2026-08-19', '2026-08-20', false, true],
    ['2026-08-18', '2026-08-20', true, true],
    ['2026-08-19', '2026-08-19', false, false],
  ] as const)('marks clipped edges for %s through %s', (start, end, before, after) => {
    const row = { id: 'staff-1' };
    const item = { id: 'task-1', start, end };
    const fixture = makeItemCalendarProps({ row, data: item, range: { start, end } });
    render(<Row row={row} rowId={row.id} rowIndex={0}
      items={[item]} getItemRange={value => value}
      periods={[period]} leadingPeriodWidth={0} gridColumns="100px 0 145px" rowHeight={80}
      getItemId={value => value.id} renderRow={() => 'Staff member'} selected={false}
      buildItem={({ calendar }) => <Item calendar={calendar} id={item.id} ariaLabel="Task item"
        summary="Task item" detailTitle="Task item" details={[]} />}
      itemResizeEnabled={false} itemMoveEnabled={false}
      onItemMove={vi.fn()} onItemResize={vi.fn()}
      itemEnvironment={fixture.environment} itemState={fixture.stateRef} />);

    const positioned = screen.getByRole('button', { name: 'Task item' }).parentElement!;
    expect(positioned.classList.contains('continues-before')).toBe(before);
    expect(positioned.classList.contains('continues-after')).toBe(after);
  });

  it('binds selection and activation callbacks to the original row and record', () => {
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
        buildItem={({ calendar }) => <Item
          calendar={calendar}
          id={item.id}
          ariaLabel="Prepare workshop"
          summary="Prepare workshop"
          detailTitle="Prepare workshop"
          details={[]}
        />}
        onItemActivate={onItemActivate}
        itemResizeEnabled={false}
        onItemMove={vi.fn()} onItemResize={vi.fn()}
        itemEnvironment={makeItemCalendarProps(fixtureTarget).environment}
        itemState={makeItemCalendarProps(fixtureTarget).stateRef}

        itemMoveEnabled={false}

      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Prepare workshop' }));

    expect(onRowSelect).toHaveBeenCalledWith({ id: 'staff-1' }, 'item');
    expect(onItemActivate).toHaveBeenCalledWith({
      row: { id: 'staff-1' },
      data: item,
      range: { start: period.key, end: period.key },
    });
  });

  it('passes calculated layout and bound actions through the item build context', () => {
    const itemState = makeItemCalendarProps(fixtureTarget).stateRef;
    const buildItem = vi.fn(() => null);
    const item = { id: 'task-1', date: period.key };
    const row = { id: 'staff-1' };
    render(<Row
      row={row} rowId={row.id} rowIndex={0} items={[item]}
      getItemRange={value => ({ start: value.date, end: value.date })}
      periods={[period]} leadingPeriodWidth={0} gridColumns="100px 0 145px" rowHeight={80}
      getItemId={value => value.id} renderRow={() => 'Staff member'} selected={false}
      buildItem={buildItem} getItemCapabilities={() => ({ draggable: true })}
      itemResizeEnabled={false}
        onItemMove={vi.fn()} onItemResize={vi.fn()} itemMoveEnabled
      itemEnvironment={makeItemCalendarProps(fixtureTarget).environment} itemState={itemState}
    />);

    expect(buildItem).toHaveBeenCalledWith(expect.objectContaining({
      calendar: expect.objectContaining({
        movable: true,
        layout: expect.objectContaining({ id: item.id, rowId: row.id, style: { gridColumn: '3 / 4', gridRow: 1, top: 8, height: 26 } }),
      }),
    }));
  });
});
