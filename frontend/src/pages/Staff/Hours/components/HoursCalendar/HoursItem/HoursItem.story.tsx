import { useState } from 'react';
import TimelineCalendar from '../../../../../../common/components/TimelineCalendar/TimelineCalendar';
import type { RowItemData } from '../../../../../../common/components/TimelineCalendar/types';
import type { HoursItem as HoursEntry } from '../../../types';
import HoursItem from './HoursItem';

interface StoryResource {
  id: string;
  name: string;
}

const resources: StoryResource[] = [
  { id: 'staff-1', name: 'Zoe Wilson' },
  { id: 'staff-2', name: 'Alex Morgan' },
];
const firstItem: HoursEntry = {
  id: 'entry-1',
  programId: 'program-1',
  programName: 'Soft Skills',
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  category: 'program_delivery',
  categoryLabel: 'Program Delivery',
  taskId: null,
  taskTitle: null, sessionId: null, sessionLabel: null,
  hours: 2,
  note: 'Workshop delivery',
};
const secondItem: HoursEntry = {
  ...firstItem,
  id: 'entry-2',
  category: 'meeting',
  categoryLabel: 'Meeting',
  hours: 1,
  note: 'Planning meeting',
};
interface StoryHoursItem { date: string; item: HoursEntry }
const items: RowItemData<StoryHoursItem> = {
  'staff-1': [
    { date: '2026-08-09', item: firstItem },
    { date: '2026-08-10', item: secondItem },
  ],
  'staff-2': [{
    date: '2026-08-09',
    item: {
      ...firstItem,
      id: 'entry-3',
      category: 'administration',
      categoryLabel: 'Administrative',
      hours: 1.5,
      note: 'Operations follow-up',
    },
  }],
};

export function InteractiveHoursItems() {
  const [actionRecord, setActionRecord] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('staff-1');
  const [selectionCount, setSelectionCount] = useState(0);
  return (
    <div style={{ height: '420px', padding: '16px' }}>
      <TimelineCalendar<StoryResource, StoryHoursItem>
        rows={resources}
        items={items}
        getItemRange={data => ({ start: data.date, end: data.date })}
        initialDate={new Date(2026, 7, 9)}
        ariaLabel="Browser-tested hours calendar"
        getRowId={row => row.id}
        getItemId={data => data.item.id}
        renderRow={({ row }) => row.name}
        selectedRowId={selectedResourceId}
        onRowSelect={row => {
          setSelectedResourceId(row.id);
          setSelectionCount(count => count + 1);
        }}
        buildItem={({ data }) => (
          <HoursItem
            item={data.item}
            onEdit={() => setActionRecord(`edit:${data.item.id}`)}
            onDelete={() => setActionRecord(`delete:${data.item.id}`)}
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
