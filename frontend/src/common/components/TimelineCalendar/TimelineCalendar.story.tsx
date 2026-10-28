import FilterCard from '../FilterCard/FilterCard';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import TimelineCalendar from './TimelineCalendar';
import Item from './components/Item/Item';
import type { ItemMoveContext, ItemResizeContext, RowItemData } from './types';

interface StoryRow {
  id: string;
  name: string;
}

interface StoryItem {
  id: string;
  label: string;
  start: string;
  end: string;
}

const rows = Array.from({ length: 60 }, (_, index) => ({
  id: `staff-${index + 1}`,
  name: `Staff ${index + 1}`,
}));

const initialItems: RowItemData<StoryItem> = {
  'staff-1': [
    { id: 'movable-entry', label: 'Movable entry', start: '2026-08-09', end: '2026-08-09' },
    { id: 'target-entry', label: 'Target entry', start: '2026-08-10', end: '2026-08-10' },
  ],
  'staff-2': [
    { id: 'crowded-1', label: 'Crowded one', start: '2026-08-09', end: '2026-08-09' },
    { id: 'crowded-2', label: 'Crowded two', start: '2026-08-09', end: '2026-08-09' },
    { id: 'crowded-3', label: 'Crowded three', start: '2026-08-09', end: '2026-08-09' },
  ],
  'staff-3': [
    { id: 'ranged-task', label: 'Ranged task', start: '2026-08-08', end: '2026-08-12' },
  ],
};

function StoryItemContent({ item }: { item: StoryItem }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onMouseEnter={() => setDetailsOpen(true)}
        onMouseLeave={() => setDetailsOpen(false)}
        onPointerDown={() => setDetailsOpen(false)}
      >
        {item.label}
      </button>
      {detailsOpen && createPortal(
        <div role="tooltip">{item.label} details</div>,
        document.body,
      )}
    </>
  );
}

function moveItem(
  current: RowItemData<StoryItem>,
  context: ItemMoveContext<StoryRow, StoryItem>,
) {
  const moved = {
    ...context.item,
    start: context.nextRange.start,
    end: context.nextRange.end,
  };
  return {
    ...current,
    [context.row.id]: (current[context.row.id] ?? []).filter(item => item.id !== moved.id),
    [context.destinationRow.id]: [
      ...(current[context.destinationRow.id] ?? []).filter(item => item.id !== moved.id),
      moved,
    ],
  };
}

export function Interactive({ withItemShell = false }: { withItemShell?: boolean } = {}) {
  const [items, setItems] = useState(initialItems);
  const [dropRecord, setDropRecord] = useState('');
  const [activationRecord, setActivationRecord] = useState('');
  const [cellClicks, setCellClicks] = useState(0);
  const [resizeRecord, setResizeRecord] = useState('');
  const [rangeMoveRecord, setRangeMoveRecord] = useState('');
  const [itemAction, setItemAction] = useState('');

  const onMove = (context: ItemMoveContext<StoryRow, StoryItem>) => {
    if (context.item.id === 'ranged-task') {
      setRangeMoveRecord(`${context.row.id}:${context.originalRange.start}:${context.originalRange.end}->${context.destinationRow.id}:${context.nextRange.start}:${context.nextRange.end}`);
    } else {
      setDropRecord(`${context.row.id}:${context.originalRange.start}->${context.destinationRow.id}:${context.nextRange.start}`);
    }
    setItems(current => moveItem(current, context));
  };
  const onResize = (context: ItemResizeContext<StoryRow, StoryItem>) => {
    setResizeRecord(`${context.edge}:${context.originalRange.start}:${context.originalRange.end}->${context.nextRange.start}:${context.nextRange.end}`);
    setItems(current => ({
      ...current,
      [context.row.id]: (current[context.row.id] ?? []).map(item => item.id === context.item.id
        ? { ...item, start: context.nextRange.start, end: context.nextRange.end }
        : item),
    }));
  };

  return (
    <div style={{ height: '620px', padding: '16px' }}>
      <TimelineCalendar<StoryRow, StoryItem>
        rows={rows}
        items={items}
        getItemRange={item => ({ start: item.start, end: item.end })}
        initialDate={new Date(2026, 7, 8)}
        ariaLabel="Browser-tested row calendar"
        rowHeader="Staff member"
        getRowId={row => row.id}
        getItemId={item => item.id}
        renderRow={({ row }) => <span>{row.name}</span>}
        buildItem={({ data: item }) => withItemShell
          ? <Item
            id={item.id}
            ariaLabel={item.label}
            summary={item.label}
            detailTitle={item.label}
            details={[{ label: 'Details', value: 'Calendar item details' }]}
            onEdit={() => setItemAction(`edit:${item.id}`)}
            onDelete={() => setItemAction(`delete:${item.id}`)}
          />
          : item.id === 'ranged-task'
          ? <button type="button">{item.label}</button>
          : <StoryItemContent item={item} />}
        getItemCapabilities={({ data: item }) => ({
          draggable: true,
          resizable: item.start !== item.end,
        })}
        onItemActivate={({ data: item }) => setActivationRecord(item.id)}
        onItemResize={onResize}
        onItemMove={onMove}
        canItemMove={({ item, row, destinationRow }) => (
          item.id === 'ranged-task' || row.id === destinationRow.id
        )}
        onCellActivate={() => setCellClicks(count => count + 1)}
      />
      <form hidden>
        <input data-testid="drop-record" readOnly value={dropRecord} />
        <input data-testid="activation-record" readOnly value={activationRecord} />
        <input data-testid="cell-clicks" readOnly value={String(cellClicks)} />
        <input data-testid="resize-record" readOnly value={resizeRecord} />
        <input data-testid="range-move-record" readOnly value={rangeMoveRecord} />
        <input data-testid="item-action" readOnly value={itemAction} />
      </form>
    </div>
  );
}

export function InteractiveItems() {
  return <Interactive withItemShell />;
}

export function RangeLaneSizing() {
  const firstRow = rows[0]!;
  const items: StoryItem[] = [
    { id: 'range-lane-1', label: 'First ranged task', start: '2026-08-09', end: '2026-08-12' },
    ...Array.from({ length: 4 }, (_, index) => ({ id: `compact-${index + 1}`, label: `Compact task ${index + 1}`, start: '2026-08-10', end: '2026-08-10' })),
    ...Array.from({ length: 6 }, (_, index) => ({ id: `dense-${index + 1}`, label: `Dense task ${index + 1}`, start: '2026-08-11', end: '2026-08-11' })),
    { id: 'isolated', label: 'Isolated ranged task', start: '2026-08-14', end: '2026-08-15' },
  ];

  return <div style={{ height: '300px', padding: '16px' }}>
    <TimelineCalendar<StoryRow, StoryItem>
      rows={[firstRow]}
      items={{ [firstRow.id]: items }}
      getItemRange={item => ({ start: item.start, end: item.end })}
      initialDate={new Date(2026, 7, 9)}
      ariaLabel="Range lane sizing calendar"
      rowHeight={112}
      getRowId={row => row.id}
      getItemId={item => item.id}
      renderRow={({ row }) => <span>{row.name}</span>}
      buildItem={({ data: item }) => <Item id={item.id} ariaLabel={item.label} summary={item.label} detailTitle={item.label} details={[]} />}
    />
  </div>;
}

export function ItemDensity() {
  const firstRow = rows[0]!;
  const makeItems = (count: number, prefix: string, date: string) => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    label: `${prefix} item ${index + 1}`,
    start: date,
    end: date,
  }));
  const items = [
    ...makeItems(3, 'normal', '2026-08-09'),
    ...makeItems(5, 'compact', '2026-08-10'),
    ...makeItems(7, 'dense', '2026-08-11'),
  ];

  return <div style={{ height: '300px', padding: '16px' }}>
    <TimelineCalendar<StoryRow, StoryItem>
      rows={[firstRow]}
      items={{ [firstRow.id]: items }}
      getItemRange={item => ({ start: item.start, end: item.end })}
      initialDate={new Date(2026, 7, 9)}
      ariaLabel="Item density calendar"
      rowHeight={112}
      getRowId={row => row.id}
      getItemId={item => item.id}
      renderRow={({ row }) => <span>{row.name}</span>}
      buildItem={({ data: item }) => <Item
        id={item.id}
        ariaLabel={item.label}
        summary={item.label}
        detailTitle={item.label}
        details={[]}
      />}
    />
  </div>;
}

export function PersistedPosition() {
  return <div style={{ height: '420px', padding: '16px' }}>
    <TimelineCalendar<StoryRow, StoryItem>
      rows={rows.slice(0, 3)}
      items={{}}
      getItemRange={item => ({ start: item.start, end: item.end })}
      initialDate={new Date(2026, 7, 8)}
      positionStorageKey="timeline-calendar:playwright-position"
      ariaLabel="Persisted-position row calendar"
      rowHeader="Staff member"
      getRowId={row => row.id}
      getItemId={item => item.id}
      renderRow={({ row }) => <span>{row.name}</span>}
      buildItem={() => null}
    />
  </div>;
}

export function PageDateRange() {
  const [dateRange, setDateRange] = useState({ start: '2028-02-28', end: '2028-03-03' });
  return <div style={{ height: '420px', padding: '16px' }}>
    <FilterCard categories={[{ id: 'status', label: 'Status', options: [{ value: 'active', label: 'Active' }] }]} values={{}} onApply={() => undefined} dateRange={{ value: dateRange, onApply: setDateRange }} />
    <TimelineCalendar<StoryRow, StoryItem>
      key={`${dateRange.start}:${dateRange.end}`}
      dateRange={dateRange}
      initialDate={new Date(2035, 0, 1)}
      rows={rows.slice(0, 2)} items={{}}
      ariaLabel="Page date range calendar"
      getItemRange={item => ({ start: item.start, end: item.end })}
      getRowId={row => row.id} getItemId={item => item.id}
      renderRow={({ row }) => <span>{row.name}</span>} buildItem={() => null}
    />
  </div>;
}
