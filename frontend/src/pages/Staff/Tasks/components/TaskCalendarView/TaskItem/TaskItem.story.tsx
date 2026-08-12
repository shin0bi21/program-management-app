import { useState } from 'react';
import ResourceCalendar from '../../../../../../common/components/ResourceCalendar/ResourceCalendar';
import type { Task } from '../../../../../../common/features/tasks/types';
import TaskItem from './TaskItem';

const resource = { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson' };
const initialTask: Task = {
  id: 'task-1', title: 'Prepare workshop', details: 'Prepare activities and materials.', category: 'planning_prep',
  programId: 'program-1', programName: 'Soft Skills', status: 'in_progress',
  startDate: '2026-08-09', dueDate: '2026-08-11', hoursLogged: 1.5,
  loggedHoursByDate: [{ date: '2026-08-10', hours: 1.5 }], completedAt: null,
  assignee: {
    id: resource.id,
    firstName: resource.firstName,
    lastName: resource.lastName,
    name: resource.name,
  }, writable: true,
};

export function InteractiveTaskItem() {
  const [task, setTask] = useState(initialTask);
  const [action, setAction] = useState('');
  const [rangeChange, setRangeChange] = useState('');
  return <div style={{ height: '300px', padding: 16 }}>
    <ResourceCalendar
      resources={[resource]}
      data={{}}
      rangeData={{ [resource.id]: [task] }}
      initialDate={new Date(2026, 7, 9)}
      ariaLabel="Browser-tested task calendar"
      getResourceId={item => item.id}
      getItemId={item => item.id}
      getItemRange={item => ({ start: item.startDate, end: item.dueDate })}
      getItemCapabilities={() => ({ draggable: true, resizable: true })}
      renderResource={({ resource: item }) => item.name}
      buildItem={() => null}
      buildRangeItem={({ data: item }) => <TaskItem task={item} onComplete={() => setAction('complete')} onEdit={() => setAction('edit')} onDelete={() => setAction('delete')} />}
      onRangeMove={({ nextRange }) => { setRangeChange(`move:${nextRange.start}:${nextRange.end}`); setTask(current => ({ ...current, startDate: nextRange.start, dueDate: nextRange.end })); }}
      onRangeResize={({ nextRange }) => { setRangeChange(`resize:${nextRange.start}:${nextRange.end}`); setTask(current => ({ ...current, startDate: nextRange.start, dueDate: nextRange.end })); }}
    />
    <input hidden readOnly data-testid="task-item-action" value={action} />
    <input hidden readOnly data-testid="task-range-change" value={rangeChange} />
  </div>;
}
