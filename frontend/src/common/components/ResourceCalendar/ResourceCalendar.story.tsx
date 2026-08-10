import { useState } from 'react';
import ResourceCalendar from './ResourceCalendar';
import type { ItemDropContext, ResourcePeriodData } from './types';

interface StoryResource {
  id: string;
  name: string;
}

interface StoryItem {
  id: string;
  label: string;
}

const resources = Array.from({ length: 60 }, (_, index) => ({
  id: `staff-${index + 1}`,
  name: `Staff ${index + 1}`,
}));

const initialData: ResourcePeriodData<StoryItem> = {
  'staff-1': {
    '2026-08-09': [{ id: 'movable-entry', label: 'Movable entry' }],
  },
  'staff-2': {
    '2026-08-09': [
      { id: 'overflow-1', label: 'Overflow one' },
      { id: 'overflow-2', label: 'Overflow two' },
      { id: 'overflow-3', label: 'Overflow three' },
    ],
  },
};

function moveItem(
  current: ResourcePeriodData<StoryItem>,
  { item, source, destination }: ItemDropContext<StoryResource, StoryItem>,
) {
  return {
    ...current,
    [source.resource.id]: {
      ...(current[source.resource.id] ?? {}),
      [source.period.key]: (current[source.resource.id]?.[source.period.key] ?? [])
        .filter(candidate => candidate.id !== item.id),
    },
    [destination.resource.id]: {
      ...(current[destination.resource.id] ?? {}),
      [destination.period.key]: [
        ...(current[destination.resource.id]?.[destination.period.key] ?? [])
          .filter(candidate => candidate.id !== item.id),
        item,
      ],
    },
  };
}

export function Interactive() {
  const [data, setData] = useState(initialData);
  const [dropRecord, setDropRecord] = useState('');
  const [cellClicks, setCellClicks] = useState(0);

  const onDrop = (context: ItemDropContext<StoryResource, StoryItem>) => {
    setDropRecord(`${context.source.resource.id}:${context.source.period.key}->${context.destination.resource.id}:${context.destination.period.key}`);
    setData(current => moveItem(current, context));
  };

  return (
    <div style={{ height: '620px', padding: '16px' }}>
      <ResourceCalendar
        resources={resources}
        data={data}
        initialDate={new Date(2026, 7, 9)}
        ariaLabel="Browser-tested resource calendar"
        resourceHeader="Staff member"
        getResourceId={resource => resource.id}
        getItemId={item => item.id}
        renderResource={({ resource }) => <span>{resource.name}</span>}
        buildItem={({ data: item }) => <button type="button">{item.label}</button>}
        maxVisibleItemsPerCell={2}
        onCellClick={() => setCellClicks(count => count + 1)}
        canDropItem={({ source, destination }) => source.resource.id === destination.resource.id}
        onItemDrop={onDrop}
      />
      <form hidden>
        <input data-testid="drop-record" readOnly value={dropRecord} />
        <input data-testid="cell-clicks" readOnly value={String(cellClicks)} />
      </form>
    </div>
  );
}
