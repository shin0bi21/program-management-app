import { useState } from 'react';
import SearchInput from './SearchInput';

export function Interactive() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  return (
    <div style={{ padding: '24px' }}>
      <SearchInput
        label="Search tasks"
        placeholder="Search tasks"
        value={search}
        appliedValue={appliedSearch}
        onChange={event => setSearch(event.target.value)}
        onApply={() => setAppliedSearch(search)}
        onClear={() => {
          setSearch('');
          setAppliedSearch('');
        }}
      />
    </div>
  );
}
