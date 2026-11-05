import { useState } from 'react';
import FloatingSelect from './FloatingSelect';
import FormField from '../FormField/FormField';

const options = Array.from({ length: 80 }, (_, index) => ({ value: String(index), label: `Timezone ${index + 1}` }));

export function Searchable({ actions = false }: { actions?: boolean }) {
  const [value, setValue] = useState('0');
  const [lastAction, setLastAction] = useState('');

  return <div style={{ padding: 24, maxWidth: 360 }}>
    <FormField id="timezone" label="Timezone">
      <FloatingSelect id="timezone" value={value} options={options} onChange={setValue} search
        action={actions ? { label: 'Add timezone', onSelect: () => setLastAction('add') } : undefined}
        optionActions={actions ? option => [{ label: 'Edit', onSelect: () => setLastAction(option.value) }] : undefined} />
    </FormField>
    <output aria-label="Selected value">{value}</output>
    <output aria-label="Last action">{lastAction}</output>
    <button type="button">Next field</button>
  </div>;
}
