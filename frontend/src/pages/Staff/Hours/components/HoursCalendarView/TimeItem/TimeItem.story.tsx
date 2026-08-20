import { useState } from 'react';
import ResourceCalendar from '../../../../../../common/components/ResourceCalendar/ResourceCalendar';
import type { ResourcePeriodData } from '../../../../../../common/components/ResourceCalendar/types';
import type { HoursItem } from '../../../../../../common/features/hours/types';
import TimeItem from './TimeItem';

interface StoryResource {
  id: string;
  name: string;
}

const resources: StoryResource[] = [
  { id: 'staff-1', name: 'Zoe Wilson' },
  { id: 'staff-2', name: 'Alex Morgan' },
];
const firstItem: HoursItem = {
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
const secondItem: HoursItem = {
  ...firstItem,
  id: 'entry-2',
  category: 'meeting',
  categoryLabel: 'Meeting',
  hours: 1,
  note: 'Planning meeting',
};
const data: ResourcePeriodData<HoursItem> = {
  'staff-1': {
    '2026-08-09': [firstItem],
    '2026-08-10': [secondItem],
  },
  'staff-2': {
    '2026-08-09': [{
      ...firstItem,
      id: 'entry-3',
      category: 'administration',
      categoryLabel: 'Administrative',
      hours: 1.5,
      note: 'Operations follow-up',
    }],
  },
};

export function InteractiveTimeItems() {
  const [actionRecord, setActionRecord] = useState('');
  const [selectedResourceId, setSelectedResourceId] = useState('staff-1');
  const [selectionCount, setSelectionCount] = useState(0);
  return (
    <div style={{ height: '420px', padding: '16px' }}>
      <ResourceCalendar
        resources={resources}
        data={data}
        initialDate={new Date(2026, 7, 9)}
        ariaLabel="Browser-tested hours calendar"
        getResourceId={resource => resource.id}
        getItemId={item => item.id}
        renderResource={({ resource }) => resource.name}
        selectedResourceId={selectedResourceId}
        onResourceSelect={resource => {
          setSelectedResourceId(resource.id);
          setSelectionCount(count => count + 1);
        }}
        buildItem={({ data: item }) => (
          <TimeItem
            item={item}
            onEdit={() => setActionRecord(`edit:${item.id}`)}
            onDelete={() => setActionRecord(`delete:${item.id}`)}
          />
        )}
        onItemDrop={() => undefined}
      />
      <input hidden readOnly data-testid="time-item-action" value={actionRecord} />
      <input hidden readOnly data-testid="selected-resource" value={selectedResourceId} />
      <input hidden readOnly data-testid="resource-selection-count" value={selectionCount} />
    </div>
  );
}
