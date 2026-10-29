import { useState } from 'react';
import FilterCard from '../../../components/FilterCard/FilterCard';
import TimelineCalendar from '../../../components/TimelineCalendar/TimelineCalendar';
import { localDateFromKey } from '../../../utils/dateRange';
import { getCycleDateRange } from './cycleDateRange';
import type { ProgramCycle } from './types';

const year = new Date().getFullYear();
const cycles: ProgramCycle[] = [
  { id: 'current', name: 'Current year', startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, state: 'active' },
  { id: 'leap', name: 'Leap cycle', startsOn: '2028-02-28', endsOn: '2028-03-03', state: 'upcoming' },
  { id: 'long', name: 'Multi-year cycle', startsOn: '2040-06-01', endsOn: '2044-06-05', state: 'upcoming' },
];
const rows = [{ id: 'staff', name: 'Staff member' }];

export function CycleCalendar({ initialDate = '2028-02-29', initialCycleIds = ['leap'] }: { initialDate?: string; initialCycleIds?: string[] } = {}) {
  const [cycleIds, setCycleIds] = useState(initialCycleIds);
  const dateRange = getCycleDateRange(cycles, cycleIds);

  return <div style={{ height: '420px', padding: '16px' }}>
    <FilterCard categories={[{ id: 'cycles', label: 'Cycles', options: cycles.map(cycle => ({ value: cycle.id, label: cycle.name })) }]}
      values={{ cycles: cycleIds }} onApply={(_id, selected) => setCycleIds(selected)} onClearAll={() => setCycleIds([])} />
    <output aria-label="Cycle bounds">{dateRange?.start} to {dateRange?.end}</output>
    <TimelineCalendar<{ id: string; name: string }, { id: string; start: string; end: string }>
      key={`${dateRange?.start}:${dateRange?.end}`}
      dateRange={dateRange}
      initialDate={localDateFromKey(initialDate)}
      positionStorageKey="cycle-calendar:browser-position"
      rows={rows} items={{}}
      ariaLabel="Cycle calendar"
      getItemRange={item => ({ start: item.start, end: item.end })}
      getRowId={row => row.id} getItemId={item => item.id}
      renderRow={({ row }) => <span>{row.name}</span>} buildItem={() => null}
    />
  </div>;
}
