import type { ReactElement, ReactNode } from 'react';
import type { TableColumnDef } from '../Table/Table.types';
import type { PageControls, PageViewControls } from './PageContainer.types';
import ColumnVisibilityMenu from '../ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard, { type FilterCardValues } from '../FilterCard/FilterCard';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import PageHeader from '../PageHeader/PageHeader';
import PageMessageOverlay, { type PageMessageValue } from '../PageMessageOverlay/PageMessageOverlay';
import { PageMessageContext, usePageMessages } from '../PageMessageOverlay/pageMessageContext';
import SearchInput from '../SearchInput/SearchInput';
import ViewMenu from '../ViewMenu/ViewMenu';
import './PageContainer.css';

interface PageSearch {
  label: string;
  placeholder?: string;
}

type PageContent<Filters extends FilterCardValues> =
  | { table: ReactNode; calendar?: never; controls?: PageControls<Filters> & { view?: never; setView?: never } }
  | { table: ReactNode; calendar: ReactNode; controls: PageViewControls<Filters> };

type PageContainerProps<T, Filters extends FilterCardValues> = PageContent<Filters> & {
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
  { id: 'calendar' as const, label: 'Calendar' },
  { id: 'table' as const, label: 'Table' },
];

/**
 * Displays a collection page with its controls, summary cards, and table or calendar.
 * While saved controls restore, actions and messages remain available but controls,
 * summary cards, and both views stay unmounted.
 * @param props.controls - Saved-input readiness, search, filters, column visibility, and the current view; omitted controls mean ready.
 * @param props.ariaLabel - Name announced for the page's main content.
 * @param props.dashboard - Summary cards displayed above the table/calendar. Pass cards directly;
 * children using usePageMessageReporter report to this page without message callbacks.
 * @param props.columns - Table columns offered in the visibility menu.
 * @param props.search - Search label and placeholder; shown only when search controls are also supplied.
 * @param props.table - The page's table.
 * @param props.calendar - The page's alternative calendar view, when available.
 * @example With controls.view='calendar', the calendar mounts and the table stays unmounted.
 */
export default function PageContainer<T, Filters extends FilterCardValues = FilterCardValues>({
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
}: PageContainerProps<T, Filters>): ReactElement {
  const childMessages = usePageMessages();
  const ready = controls?.ready ?? true;
  const filters = controls?.filters;
  const searchControls = controls?.search;

  const activeView = controls?.view ?? 'table';
  const content = activeView === 'calendar' ? calendar : table;
  const contentClassName = activeView === 'calendar' ? 'page-calendar' : 'page-table';

  /**
   * Updates the category that FilterCard applied or cleared.
   * @example applyFilter('statuses', ['active'])
   */
  const applyFilter = (id: string, selected: string[]): void => {
    filters?.update({ [id]: selected } as Partial<Filters>);
  };

  /**
   * Clears all supplied filter fields, including categories hidden by the page.
   * @example clearFilters() // sends { statuses: [], roles: [] } for those two fields
   */
  const clearFilters = (): void => {
    if (!filters) return;

    const cleared: FilterCardValues = Object.fromEntries(
      Object.keys(filters.values).map(id => [id, []]),
    );
    filters.update(cleared as Partial<Filters>);
  };

  return (
    <PageMessageContext.Provider value={childMessages.reportMessage}>
      <main className={`page-container${className ? ` ${className}` : ''}`} aria-label={ariaLabel} data-view={dataView}>
        <PageHeader
          title={title}
          actions={actions}
          search={ready && search && searchControls ? <SearchInput
            label={search.label}
            placeholder={search.placeholder}
            appliedValue={searchControls.appliedValue}
            onApply={searchControls.apply}
          /> : undefined}
          filters={ready && filters ? <FilterCard
            categories={filters.definitions}
            values={filters.values}
            onApply={applyFilter}
            onClearAll={clearFilters}
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
        <PageMessageOverlay messages={[...messages, ...childMessages.messages]} />
        {/* Wait for saved controls before mounting views that fetch data from those inputs. */}
        {ready ? (
          <>
            {dashboard != null && <aside className="page-dashboard">{dashboard}</aside>}
            <div className={contentClassName}>{content}</div>
          </>
        ) : (
          <p role="status" className={loadingSpinner ? 'page-loading-status' : undefined}>
            {loadingSpinner && <LoadingSpinner />}
            {loadingLabel}
          </p>
        )}
      </main>
    </PageMessageContext.Provider>
  );
}
