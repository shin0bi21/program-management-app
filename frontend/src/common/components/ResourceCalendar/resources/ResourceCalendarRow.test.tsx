import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CalendarPeriod } from '../types';
import ResourceCalendarRow from './ResourceCalendarRow';

const period: CalendarPeriod = {
  key: '2026-08-19',
  start: new Date(2026, 7, 19),
  end: new Date(2026, 7, 20),
};

describe('ResourceCalendarRow', () => {
  it('starts point-item dragging from the rendered item bounds and pickup position', () => {
    const beginDrag = vi.fn();
    render(
      <ResourceCalendarRow
        resource={{ id: 'staff-1' }}
        resourceIndex={0}
        resourceData={{ [period.key]: [{ id: 'task-1' }] }}
        rangeItems={[]}
        periods={[period]}
        leadingPeriodWidth={0}
        gridColumns="100px 0 145px"
        rowHeight={80}
        getResourceId={resource => resource.id}
        getItemId={item => item.id}
        renderResource={() => 'Staff member'}
        selected={false}
        buildItem={() => <button type="button">Task item</button>}
        rangeResizeEnabled={false}
        beginResize={vi.fn()}
        resizeByKeyboard={vi.fn()}
        suppressResizeClickRef={{ current: false }}
        rangeMoveEnabled={false}
        beginRangeMove={vi.fn()}
        suppressRangeMoveClickRef={{ current: false }}
        onItemDropEnabled
        maxVisibleItemsPerCell={7}
        beginDrag={beginDrag}
        suppressClickRef={{ current: false }}
        today={new Date(2026, 7, 19, 12)}
      />,
    );
    const item = screen.getByRole('button', { name: 'Task item' });
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
      left: 100, top: 50, right: 220, bottom: 80, width: 120, height: 30,
      x: 100, y: 50, toJSON: () => undefined,
    });

    fireEvent.pointerDown(item.parentElement!, {
      pointerId: 10,
      button: 0,
      clientX: 140,
      clientY: 70,
    });

    expect(beginDrag).toHaveBeenCalledWith(expect.objectContaining({
      pointerId: 10,
      width: 120,
      grabOffsetX: 40,
      grabOffsetY: 20,
      context: {
        resource: { id: 'staff-1' },
        period,
        data: { id: 'task-1' },
      },
    }));
  });
});
