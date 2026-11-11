import { makeHoursItem } from '../../../../../../tests/factories/hours';
import { useState } from 'react';
import TimelineCalendar from '../../../../../../common/components/TimelineCalendar/TimelineCalendar';
import type { HoursItem } from '../../../types';
import HoursCalendarItem from './HoursItem';

interface StoryResource {
  id: string;
  name: string;
}

const resources: StoryResource[] = [
  { id: 'staff-1', name: 'Zoe Wilson' },
  { id: 'staff-2', name: 'Alex Morgan' },
];
const firstItem: HoursItem = makeHoursItem({
  id: 'entry-1',
  programId: 'program-1',
  program: 'Soft Skills',
  cycleId: 'cycle-1',
  cycle: 'Summer 2026',
  category: 'program_delivery',
  categoryLabel: 'Program Delivery',
  taskId: null,
  taskTitle: null, sessionId: null, sessionLabel: null,
  hours: 2,
  note: 'Workshop delivery',
});
const secondItem: HoursItem = {
  ...firstItem,
  id: 'entry-2',
  category: 'meeting',
  categoryLabel: 'Meeting',
  hours: 1,
  note: 'Planning meeting',
};
const items: HoursItem[] = [
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
  const [selectedResourceId, setSelectedResourceId] = useState('staff-1');
  const [selectionCount, setSelectionCount] = useState(0);
  return (
    <div style={{ height: '420px', padding: '16px' }}>
      <TimelineCalendar<StoryResource, HoursItem>
        rows={resources}
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
        selectedRowId={selectedResourceId}
        onRowSelect={row => {
          setSelectedResourceId(row.id);
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
      <input hidden readOnly data-testid="selected-resource" value={selectedResourceId} />
      <input hidden readOnly data-testid="resource-selection-count" value={selectionCount} />
    </div>
  );
}
