import { useState } from 'react';
import SearchInput from '../SearchInput/SearchInput';
import PageHeader from './PageHeader';

export function StableControls() {
  const [showColumns, setShowColumns] = useState(true);
  const [search, setSearch] = useState('');

  return (
    <div style={{ padding: '24px' }}>
      <PageHeader
        title="Tasks"
        actions={(
          <button type="button" onClick={() => setShowColumns(current => !current)}>
            Toggle columns
          </button>
        )}
        columns={showColumns ? <button type="button">Columns</button> : undefined}
        view={<button type="button">View</button>}
        search={(
          <SearchInput
            label="Search tasks"
            value={search}
            appliedValue=""
            onChange={event => setSearch(event.target.value)}
            onApply={() => undefined}
            onClear={() => setSearch('')}
          />
        )}
        filters={<button type="button">Filters</button>}
      />
    </div>
  );
}
