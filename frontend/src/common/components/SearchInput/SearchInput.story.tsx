import { useState } from 'react';
import SearchInput from './SearchInput';

export function Interactive() {
  const [appliedSearch, setAppliedSearch] = useState('');

  return (
    <div style={{ padding: '24px' }}>
      <SearchInput
        label="Search tasks"
        placeholder="Search tasks"
        appliedValue={appliedSearch}
        onApply={setAppliedSearch}
      />
    </div>
  );
}
