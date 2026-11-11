import { makeItemCalendarProps } from '../../../../../tests/factories/calendarItem';
// This suite owns virtual row offsets and row-to-row data mapping.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildInitialDayPeriods } from '../../utils/periods';
import Grid from './Grid';

vi.mock('../Row/Row', () => ({
  default: ({
    row,
    rowIndex,
    items,
    selected,
  }: {
    row: { id: string; name: string };
    rowIndex: number;
    items: readonly { id: string }[];
    selected: boolean;
  }) => <div role="row">
    {row.name}:{rowIndex}:{items.map(item => item.id).join(',')}:{String(selected)}
  </div>,
}));

const fixtureTarget = { row: { id: 'staff-1', name: 'Alex' }, data: { id: 'task-1' }, range: { start: '2026-08-19', end: '2026-08-19' } };

describe('Grid', () => {
  it('maps each visible row to its data, selection, and virtual offset', () => {
    const periods = buildInitialDayPeriods('2026-08-10', 2);
    const firstItem = { id: 'entry-1' };
    const rangedItem = { id: 'task-1' };
    const getRowId = vi.fn((row: { id: string }) => row.id);

    render(<Grid
      rows={[{ id: 'staff-1', name: 'Alex' }, { id: 'staff-2', name: 'Zoe' }]}
      firstRowIndex={4}
      periods={periods}
      leadingPeriodWidth={145}
      items={{ 'staff-1': [firstItem], 'staff-2': [rangedItem] }}
      getItemRange={() => ({ start: periods[0].key, end: periods[0].key })}
      gridColumns="125px 145px repeat(2, 145px)"
      rowHeight={92}
      topSpacerHeight={184}
      bottomSpacerHeight={276}
      rowHeader="Staff"
      getRowId={getRowId}
      getItemId={item => item.id}
      renderRow={({ row }) => row.name}
      selectedRowId="staff-2"
      buildItem={() => null}
      itemResizeEnabled={false}
        onItemMove={vi.fn()} onItemResize={vi.fn()}
        itemEnvironment={makeItemCalendarProps(fixtureTarget).environment}
        itemState={makeItemCalendarProps(fixtureTarget).stateRef}

      itemMoveEnabled={false}

      formatPeriodLabel={period => period.key}
      today={periods[0].start}
    />);

    expect(screen.getByText('Alex:4:entry-1:false')).toBeInTheDocument();
    expect(screen.getByText('Zoe:5:task-1:true')).toBeInTheDocument();
  });
});
