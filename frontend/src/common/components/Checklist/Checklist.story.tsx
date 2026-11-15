import { useState } from 'react';
import Checklist from './Checklist';
import FilterCard from '../FilterCard/FilterCard';
import FormFieldGroup from '../FormField/FormFieldGroup';

const options = [{ id: 'fall', name: 'Fall 2026' }, { id: 'spring', name: 'Spring 2026' }];

export function FormAndFilter() {
  const [selected, setSelected] = useState(['fall']);
  const [filters, setFilters] = useState(['fall']);

  return <div style={{ padding: 24 }}>
    <FormFieldGroup label="Assigned cycles">
      <Checklist variant="form" ariaLabel="Assigned cycles" options={options} value={selected}
        onToggle={value => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} />
    </FormFieldGroup>
    <FilterCard categories={[{ id: 'cycle', label: 'Cycle', options }]} values={{ cycle: filters }}
      onApply={(_, value) => setFilters(value)} />
  </div>;
}

const longOptions = Array.from({ length: 63 }, (_, index) => ({ id: String(index), name: `Person ${index + 1}` }));

export function SearchableDynamic({ variant = 'form', containerHeight }: {
  variant?: 'compact' | 'form';
  containerHeight?: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  return <div style={{ padding: 24, maxWidth: 400, height: containerHeight, display: 'grid' }}>
    <Checklist options={longOptions} value={selected} ariaLabel="People" variant={variant} dynamicItems search
      onToggle={value => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} />
  </div>;
}
