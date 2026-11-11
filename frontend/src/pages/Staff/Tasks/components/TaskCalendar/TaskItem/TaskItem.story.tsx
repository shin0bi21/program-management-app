import { useState } from 'react';
import TimelineCalendar from '../../../../../../common/components/TimelineCalendar/TimelineCalendar';
import type { Task } from '../../../types';
import TaskItem from './TaskItem';

const resource = { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' };
const initialTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: 'Prepare activities and materials.', category: 'planning_prep',
  categoryLabel: 'Planning / Prep', programId: 'program-1', program: 'Soft Skills', state: 'open',
  status: 'in_progress', statusLabel: 'In Progress',
  startDate: '2026-08-09', dueDate: '2026-08-11', hoursLogged: 1.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 1.5 }], completedAt: null,
  staffId: resource.id, firstName: resource.firstName, lastName: resource.lastName, name: resource.name,
  writable: true,
};

export function InteractiveTaskItem() {
  const [task, setTask] = useState(initialTask);
  const [action, setAction] = useState('');
  const [activatedTaskId, setActivatedTaskId] = useState('');
  const [rangeChange, setRangeChange] = useState('');
  return <div style={{ height: '300px', padding: 16 }}>
    <TimelineCalendar
      rows={[resource]}
      items={{ [resource.id]: [task] }}
      initialDate={'2026-08-09'}
      ariaLabel="Browser-tested task calendar"
      getRowId={item => item.id}
      getItemId={item => item.id}
      getItemRange={item => ({ start: item.startDate, end: item.dueDate })}
      getItemCapabilities={() => ({ draggable: true, resizable: true })}
      renderRow={({ row: item }) => item.name}
      buildItem={({ data: item, calendar }) => <TaskItem calendar={calendar} task={item} onComplete={() => setAction('complete')} onEdit={() => setAction('edit')} onDelete={() => setAction('delete')} />}
      onItemActivate={({ data: item }) => setActivatedTaskId(item.id)}
      onItemMove={({ nextRange }) => { setRangeChange(`move:${nextRange.start}:${nextRange.end}`); setTask(current => ({ ...current, startDate: nextRange.start, dueDate: nextRange.end })); }}
      onItemResize={({ nextRange }) => { setRangeChange(`resize:${nextRange.start}:${nextRange.end}`); setTask(current => ({ ...current, startDate: nextRange.start, dueDate: nextRange.end })); }}
    />
    <input hidden readOnly data-testid="task-item-action" value={action} />
    <input hidden readOnly data-testid="task-item-activation" value={activatedTaskId} />
    <input hidden readOnly data-testid="task-range-change" value={rangeChange} />
  </div>;
}
