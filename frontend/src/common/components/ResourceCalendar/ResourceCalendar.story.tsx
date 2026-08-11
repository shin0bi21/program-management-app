import { useState } from 'react';
import { createPortal } from 'react-dom';
import ResourceCalendar from './ResourceCalendar';
import type { ItemDropContext, RangeMoveContext, RangeResizeContext, ResourcePeriodData } from './types';

interface StoryResource {
  id: string;
  name: string;
}

interface StoryItem {
  id: string;
  label: string;
  start?: string;
  end?: string;
}

const resources = Array.from({ length: 60 }, (_, index) => ({
  id: `staff-${index + 1}`,
  name: `Staff ${index + 1}`,
}));

const initialData: ResourcePeriodData<StoryItem> = {
  'staff-1': {
    '2026-08-09': [{ id: 'movable-entry', label: 'Movable entry' }],
    '2026-08-10': [{ id: 'target-entry', label: 'Target entry' }],
  },
  'staff-2': {
    '2026-08-09': [
      { id: 'overflow-1', label: 'Overflow one' },
      { id: 'overflow-2', label: 'Overflow two' },
      { id: 'overflow-3', label: 'Overflow three' },
    ],
  },
};

function StoryCalendarItem({ item, onActivate }: { item: StoryItem; onActivate: () => void }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onMouseEnter={() => setDetailsOpen(true)}
        onMouseLeave={() => setDetailsOpen(false)}
        onPointerDown={() => setDetailsOpen(false)}
        onClick={onActivate}
      >
        {item.label}
      </button>
      {detailsOpen && createPortal(
        <div role="tooltip">
          {item.label} details
        </div>,
        document.body,
      )}
    </>
  );
}

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
  const [activationRecord, setActivationRecord] = useState('');
  const [cellClicks, setCellClicks] = useState(0);
  const [rangeItems, setRangeItems] = useState<StoryItem[]>([
    { id: 'ranged-task', label: 'Ranged task', start: '2026-08-08', end: '2026-08-12' },
  ]);
  const [rangeResourceId, setRangeResourceId] = useState('staff-3');
  const [resizeRecord, setResizeRecord] = useState('');
  const [rangeMoveRecord, setRangeMoveRecord] = useState('');

  const onDrop = (context: ItemDropContext<StoryResource, StoryItem>) => {
    setDropRecord(`${context.source.resource.id}:${context.source.period.key}->${context.destination.resource.id}:${context.destination.period.key}`);
    setData(current => moveItem(current, context));
  };
  const onResize = (context: RangeResizeContext<StoryResource, StoryItem>) => {
    setResizeRecord(`${context.edge}:${context.originalRange.start}:${context.originalRange.end}->${context.nextRange.start}:${context.nextRange.end}`);
    setRangeItems(current => current.map(item => item.id === context.item.id
      ? { ...item, start: context.nextRange.start, end: context.nextRange.end }
      : item));
  };
  const onRangeMove = (context: RangeMoveContext<StoryResource, StoryItem>) => {
    setRangeMoveRecord(`${context.resource.id}:${context.originalRange.start}:${context.originalRange.end}->${context.destinationResource.id}:${context.nextRange.start}:${context.nextRange.end}`);
    setRangeResourceId(context.destinationResource.id);
    setRangeItems(current => current.map(item => item.id === context.item.id
      ? { ...item, start: context.nextRange.start, end: context.nextRange.end }
      : item));
  };

  return (
    <div style={{ height: '620px', padding: '16px' }}>
      <ResourceCalendar
        resources={resources}
        data={data}
        rangeData={{ [rangeResourceId]: rangeItems }}
        getItemRange={item => ({ start: item.start!, end: item.end! })}
        initialDate={new Date(2026, 7, 8)}
        ariaLabel="Browser-tested resource calendar"
        resourceHeader="Staff member"
        getResourceId={resource => resource.id}
        getItemId={item => item.id}
        renderResource={({ resource }) => <span>{resource.name}</span>}
        buildItem={({ data: item }) => <StoryCalendarItem item={item} onActivate={() => setActivationRecord(item.id)} />}
        buildRangeItem={({ data: item }) => <button type="button">{item.label}</button>}
        getItemCapabilities={() => ({ draggable: true, resizable: true })}
        onItemActivate={({ data: item }) => setActivationRecord(item.id)}
        onRangeResize={onResize}
        onRangeMove={onRangeMove}
        maxVisibleItemsPerCell={2}
        onCellActivate={() => setCellClicks(count => count + 1)}
        canDropItem={({ source, destination }) => source.resource.id === destination.resource.id}
        onItemDrop={onDrop}
      />
      <form hidden>
        <input data-testid="drop-record" readOnly value={dropRecord} />
        <input data-testid="activation-record" readOnly value={activationRecord} />
        <input data-testid="cell-clicks" readOnly value={String(cellClicks)} />
        <input data-testid="resize-record" readOnly value={resizeRecord} />
        <input data-testid="range-move-record" readOnly value={rangeMoveRecord} />
      </form>
    </div>
  );
}

export function RangeLaneSizing() {
  const firstResource = resources[0]!;
  const tasks: StoryItem[] = [
    { id: 'range-lane-1', label: 'First ranged task', start: '2026-08-09', end: '2026-08-12' },
    { id: 'range-lane-2', label: 'Second ranged task', start: '2026-08-09', end: '2026-08-12' },
  ];

  return <div style={{ height: '300px', padding: '16px' }}>
    <ResourceCalendar
      resources={[firstResource]}
      data={{}}
      rangeData={{ [firstResource.id]: tasks }}
      getItemRange={item => ({ start: item.start!, end: item.end! })}
      initialDate={new Date(2026, 7, 9)}
      ariaLabel="Range lane sizing calendar"
      getResourceId={resource => resource.id}
      getItemId={item => item.id}
      renderResource={({ resource }) => <span>{resource.name}</span>}
      buildItem={() => null}
      buildRangeItem={({ data: item }) => <button type="button">{item.label}</button>}
    />
  </div>;
}
