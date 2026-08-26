// This suite owns grid headers, virtual spacers, and row-to-row data mapping.
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

describe('Grid', () => {
  it('renders period headers and maps each visible row to its owned data', () => {
    const periods = buildInitialDayPeriods(new Date(2026, 7, 10), 2);
    const firstItem = { id: 'entry-1' };
    const rangedItem = { id: 'task-1' };
    const getRowId = vi.fn((row: { id: string }) => row.id);

    const { container } = render(<Grid
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
      beginItemResize={vi.fn()}
      resizeByKeyboard={vi.fn()}
      suppressResizeClickRef={{ current: false }}
      itemMoveEnabled={false}
      beginItemMove={vi.fn()}
      suppressMoveClickRef={{ current: false }}
      formatPeriodLabel={period => period.key}
      today={periods[0].start}
    />);

    expect(screen.getByRole('columnheader', { name: 'Staff' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: periods[0].key })).toHaveClass('period', 'today');
    expect(screen.getByText('Alex:4:entry-1:false')).toBeInTheDocument();
    expect(screen.getByText('Zoe:5:task-1:true')).toBeInTheDocument();
    expect(getRowId).toHaveBeenCalledTimes(2);
    const spacers = container.querySelectorAll('[aria-hidden="true"]');
    expect(spacers[1]).toHaveStyle({ height: '184px' });
    expect(spacers[2]).toHaveStyle({ height: '276px' });
  });
});
