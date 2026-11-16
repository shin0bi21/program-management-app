import { useState } from 'react';
import Checklist from '../Checklist/Checklist';
import FloatingSelect from '../FloatingSelect/FloatingSelect';
import FormField from './FormField';
import FormFieldGroup from './FormFieldGroup';

const options = [{ id: 'fall', label: 'Fall 2026' }, { id: 'spring', label: 'Spring 2026' }];

export function StandardFields() {
  const [selected, setSelected] = useState<string[]>([]);
  const [cycle, setCycle] = useState('fall');

  return <form style={{ padding: 24, maxWidth: 500 }}>
    <FormField id="field-name" label="Name">
      <input id="field-name" defaultValue="Example" />
    </FormField>
    <FormField id="field-date" label="Date">
      <input id="field-date" type="date" defaultValue="2026-10-30" />
    </FormField>
    <FormField id="field-cycle" label="Cycle">
      <FloatingSelect id="field-cycle" value={cycle} options={options} onChange={setCycle} />
    </FormField>
    <FormFieldGroup label="Assigned cycles">
      <Checklist
        variant="form"
        ariaLabel="Assigned cycles"
        options={options}
        value={selected}
        onToggle={value => setSelected(current => current.includes(value)
          ? current.filter(id => id !== value)
          : [...current, value])}
      />
    </FormFieldGroup>
  </form>;
}
