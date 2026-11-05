import type { ReactNode } from 'react';
import type { TableColumnDef } from '../Table/Table.types';
import type { PageControls, PageViewControls } from './PageContainer.types';
import ColumnVisibilityMenu from '../ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../FilterCard/FilterCard';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import PageBody from '../PageBody/PageBody';
import PageHeader from '../PageHeader/PageHeader';
import PageMessageOverlay, { type PageMessageValue } from '../PageMessageOverlay/PageMessageOverlay';
import SearchInput from '../SearchInput/SearchInput';
import ViewMenu from '../ViewMenu/ViewMenu';

interface PageSearch {
  label: string;
  placeholder?: string;
}

type PageContent =
  | { table: ReactNode; calendar?: never; controls?: PageControls & { view?: never; setView?: never } }
  | { table: ReactNode; calendar: ReactNode; controls: PageViewControls };

type PageContainerProps<T> = PageContent & {
  title: string;
  ariaLabel: string;
  className?: string;
  'data-view'?: string;
  actions?: ReactNode;
  messages?: readonly PageMessageValue[];
  loadingLabel?: string;
  loadingSpinner?: boolean;
  dashboard?: ReactNode;
  search?: PageSearch;
  columns?: TableColumnDef<T>[];
};

const VIEW_OPTIONS = [
  { value: 'calendar' as const, label: 'Calendar' },
  { value: 'table' as const, label: 'Table' },
];

export default function PageContainer<T>({
  title,
  ariaLabel,
  className,
  'data-view': dataView,
  actions,
  messages = [],
  controls,
  loadingLabel = 'Loading page preferences…',
  loadingSpinner = false,
  dashboard,
  search,
  columns,
  table,
  calendar,
}: PageContainerProps<T>) {
  const ready = controls?.ready ?? true;
  const filters = controls?.filters;
  const searchControls = controls?.search;

  const activeView = controls?.view ?? 'table';
  const content = activeView === 'calendar' ? { calendar } : { table };

  return (
    <main className={`page-container${className ? ` ${className}` : ''}`} data-view={dataView}>
      <PageHeader
        title={title}
        actions={actions}
        search={ready && search && searchControls ? <SearchInput
          label={search.label}
          placeholder={search.placeholder}
          value={searchControls.value}
          appliedValue={searchControls.appliedValue}
          onChange={event => searchControls.setValue(event.target.value)}
          onApply={searchControls.apply}
          onClear={searchControls.clear}
        /> : undefined}
        filters={ready && filters ? <FilterCard
          categories={filters.definitions}
          values={filters.values}
          onApply={filters.apply}
          onClearAll={filters.clear}
        /> : undefined}
        view={ready && controls?.view ? <ViewMenu
          value={controls.view}
          onChange={controls.setView}
          options={VIEW_OPTIONS}
        /> : undefined}
        columns={ready && activeView === 'table' && columns && controls?.table
          ? <ColumnVisibilityMenu
            columns={columns}
            hiddenColumnKeys={controls.table.hiddenColumns}
            onHiddenColumnKeysChange={controls.table.setHiddenColumns}
          />
          : undefined}
      />
      <PageMessageOverlay messages={messages} />
      {/* Keep view queries and dashboard effects unmounted until their saved inputs are ready. */}
      {ready ? (
        <PageBody ariaLabel={ariaLabel} dashboard={dashboard} {...content} />
      ) : (
        <p role="status" className={loadingSpinner ? 'page-loading-status' : undefined}>
          {loadingSpinner && <LoadingSpinner />}
          {loadingLabel}
        </p>
      )}
    </main>
  );
}
