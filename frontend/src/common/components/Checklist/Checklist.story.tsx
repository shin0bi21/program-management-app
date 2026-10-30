import { useState } from 'react';
import Checklist from './Checklist';
import FilterCard from '../FilterCard/FilterCard';

const options = [{ value: 'fall', label: 'Fall 2026' }, { value: 'spring', label: 'Spring 2026' }];

export function FormAndFilter() {
  const [selected, setSelected] = useState(['fall']);
  const [filters, setFilters] = useState(['fall']);

  return <div style={{ padding: 24 }}>
    <Checklist ariaLabel="Assigned cycles" options={options} value={selected}
      onToggle={value => setSelected(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])} />
    <FilterCard categories={[{ id: 'cycle', label: 'Cycle', options }]} values={{ cycle: filters }}
      onApply={(_, value) => setFilters(value)} />
  </div>;
}
