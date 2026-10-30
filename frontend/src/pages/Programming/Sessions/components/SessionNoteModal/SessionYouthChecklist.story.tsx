import { useState } from 'react';
import SessionYouthChecklist from './SessionYouthChecklist';
import './SessionNoteModal.css';

const roster = Array.from({ length: 20 }, (_, index) => ({
  youthId: `youth-${index}`,
  firstName: index === 0 ? 'Alexandria'.repeat(8) : 'Youth',
  lastName: `Participant ${index + 1}`,
  status: null,
  notes: null,
}));

export function LongRoster() {
  const [selected, setSelected] = useState<string[]>([]);

  return <div style={{ padding: 24 }}>
    <SessionYouthChecklist
      enrollmentRequired
      roster={roster}
      selectedYouthIds={selected}
      loading={false}
      disabled={false}
      onToggle={value => setSelected(current => current.includes(value)
        ? current.filter(id => id !== value)
        : [...current, value])}
    />
  </div>;
}
