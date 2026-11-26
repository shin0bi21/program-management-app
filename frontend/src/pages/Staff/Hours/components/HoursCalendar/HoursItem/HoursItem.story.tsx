import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { useState } from 'react';
import TimelineCalendar from '../../../../../../common/components/TimelineCalendar/TimelineCalendar';
import type { Hours } from '../../../types';
import HoursCalendarItem from './HoursItem';

interface StoryStaff {
  id: string;
  name: string;
}

const staff: StoryStaff[] = [
  { id: 'staff-1', name: 'Zoe Wilson' },
  { id: 'staff-2', name: 'Alex Morgan' },
];
const firstItem: Hours = makeHoursItem({
  id: 'entry-1',
  programId: 'program-1',
  program: 'Soft Skills',
  cycleId: 'cycle-1',
  cycle: 'Summer 2026',
  category: 'program_delivery',
  categoryLabel: 'Program Delivery',
  taskId: null,
  taskTitle: null, sessionId: null, sessionTitle: null,
  hours: 2,
  note: 'Workshop delivery',
});
const secondItem: Hours = {
  ...firstItem,
  id: 'entry-2',
  category: 'meeting',
  categoryLabel: 'Meeting',
  hours: 1,
  note: 'Planning meeting',
};
const items: Hours[] = [
  { ...firstItem, date: '2026-08-09' },
  { ...secondItem, date: '2026-08-10' },
  {
    ...firstItem,
    id: 'entry-3',
    staffId: 'staff-2',
    date: '2026-08-09',
    category: 'administration',
    categoryLabel: 'Administrative',
    hours: 1.5,
    note: 'Operations follow-up',
  },
];

export function InteractiveHoursItems() {
  const [actionRecord, setActionRecord] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('staff-1');
  const [selectionCount, setSelectionCount] = useState(0);
  return (
    <div style={{ height: '420px', padding: '16px' }}>
      <TimelineCalendar<StoryStaff, Hours>
        rows={staff}
        items={{
          'staff-1': items.filter(item => item.staffId === 'staff-1'),
          'staff-2': items.filter(item => item.staffId === 'staff-2'),
        }}
        getItemRange={data => ({ start: data.date, end: data.date })}
        initialDate={'2026-08-09'}
        ariaLabel="Browser-tested hours calendar"
        getRowId={row => row.id}
        getItemId={data => data.id}
        renderRow={({ row }) => row.name}
        selectedRowId={selectedStaffId}
        onRowSelect={row => {
          setSelectedStaffId(row.id);
          setSelectionCount(count => count + 1);
        }}
        buildItem={({ data, calendar }) => (
          <HoursCalendarItem
            calendar={calendar}
            item={data}
            onEdit={() => setActionRecord(`edit:${data.id}`)}
            onDelete={() => setActionRecord(`delete:${data.id}`)}
          />
        )}
        getItemCapabilities={() => ({ draggable: true })}
        onItemMove={() => undefined}
      />
      <input hidden readOnly data-testid="hours-item-action" value={actionRecord} />
      <input hidden readOnly data-testid="selected-staff" value={selectedStaffId} />
      <input hidden readOnly data-testid="staff-selection-count" value={selectionCount} />
    </div>
  );
}
