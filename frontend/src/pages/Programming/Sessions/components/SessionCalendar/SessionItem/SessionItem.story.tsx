import { useState } from 'react';
import TimelineCalendar from '../../../../../../common/components/TimelineCalendar/TimelineCalendar';
import { makeProgramSession } from '../../../../../../tests/factories/session';
import SessionItem from './SessionItem';

const program = { id: 'program-1', title: 'Soft Skills' };
const session = makeProgramSession({ date: '2026-08-09', startTime: '17:30', endTime: '19:30' });

export function InteractiveSessionItem() {
  const [action, setAction] = useState('');
  return <div style={{ height: 300, padding: 16 }}>
    <TimelineCalendar rows={[program]} items={{ [program.id]: [session] }}
      initialDate={'2026-08-09'} ariaLabel="Browser-tested session calendar"
      getRowId={row => row.id} getItemId={item => item.id}
      getItemRange={() => ({ start: '2026-08-09', end: '2026-08-09' })}
      getItemCapabilities={() => ({ draggable: true, resizable: false })}
      renderRow={({ row }) => row.title}
      buildItem={({ calendar }) => <SessionItem calendar={calendar} session={session} selected
        onEdit={() => setAction('edit')} onDelete={() => setAction('delete')} />} />
    <input hidden readOnly data-testid="session-action" value={action} />
  </div>;
}

export function EdgeSessionItem() {
  return <div style={{ position: 'fixed', right: 8, bottom: 8, width: 145, height: 32 }}>
    <SessionItem session={session} onEdit={() => undefined} onDelete={() => undefined} />
  </div>;
}

export function SelectingSessionItem() {
  const [selected, setSelected] = useState(false);
  return <div>
    <div style={{ height: selected ? 180 : 40 }}>Session overview</div>
    <div onClick={() => setSelected(true)} style={{ width: 160, height: 32 }}>
      <SessionItem session={session} selected={selected} onEdit={() => undefined} onDelete={() => undefined} />
    </div>
  </div>;
}
