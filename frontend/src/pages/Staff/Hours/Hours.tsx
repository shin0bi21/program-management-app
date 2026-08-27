import { useCallback, useState } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay, { type PageErrorItem } from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import HoursModal from './components/HoursModal/HoursModal';
import HoursCalendar from './components/HoursCalendar/HoursCalendar';
import HoursDashboard from './components/HoursDashboard/HoursDashboard';
import HoursTable from './components/HoursTable/HoursTable';

import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import useHoursTable from './components/HoursTable/hooks/useHoursTable';
import useHoursActions from './hooks/actions/useHoursActions';
import useHoursData from './hooks/data/useHoursData';
import useHoursPreferences from './hooks/preferences/useHoursPreferences';
import useHoursSelection from './hooks/selection/useHoursSelection';

import type { SetHoursInput } from './hours.api';
import { getTaskDashboardData } from '../Tasks/tasks.api';
import { HOURS_TABLE_KEYS, type HoursEntryTarget } from './types';

import './Hours.css';

type HoursAddTarget = {
  resourceId?: string;
  date?: string;
  source?: 'regular' | 'task' | 'session';
};

type HoursModalState =
  | { mode: 'add'; initialValues: HoursAddTarget }
  | { mode: 'edit'; target: HoursEntryTarget }
  | null;

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;
const HOURS_TABLE_QUERY_KEY = [...HOURS_QUERY_KEY, 'table'] as const;
const HOURS_REFERENCE_DATA_QUERY_KEY = ['hours-reference-data'] as const;
const PROGRAM_CYCLES_QUERY_KEY = ['program-cycles'] as const;

export default function Hours() {
  const [viewError, setViewError] = useState<PageErrorItem | null>(null);
  const [dashboardError, setDashboardError] = useState<PageErrorItem | null>(null);

  // Permissions.
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:hours');
  const canCompleteTask = permissions.includes('write:tasks');

  // Page data and preferences.
  const pageData = useHoursData(
    HOURS_REFERENCE_DATA_QUERY_KEY,
    PROGRAM_CYCLES_QUERY_KEY,
    currentUserId,
  );

  const preferences = useHoursPreferences({
    role,
    resources: pageData.resources,
    programs: pageData.programs,
    cycles: pageData.cycles,
    categories: pageData.categories,
    types: pageData.types,
    loadingDependencies: pageData.optionsLoading || pageData.cyclesLoading,
    optionsError: Boolean(pageData.optionsError),
    cyclesError: Boolean(pageData.cyclesError),
    tableKeys: HOURS_TABLE_KEYS,
  });

  // Selection and actions.
  const selection = useHoursSelection({
    resources: pageData.resources,
    currentUserResource: pageData.currentUserResource,
    cycleId: preferences.filters.cycleId,
    onCycleSelect: preferences.filters.selectCycle,
  });

  const actions = useHoursActions({
    hoursQueryKey: HOURS_QUERY_KEY,
    hoursTableQueryKey: HOURS_TABLE_QUERY_KEY,
    taskQueryKey: TASK_QUERY_KEY,
    onEntryRemoved: entryId => {
      setHoursModalState(current => (
        current?.mode === 'edit' && current.target.item.id === entryId ? null : current
      ));
    },
  });

  // Hours modal.
  const [hoursModalState, setHoursModalState] = useState<HoursModalState>(null);

  const openAddHoursModal = useCallback((initialValues: HoursAddTarget) => {
    setHoursModalState({ mode: 'add', initialValues });
  }, []);

  const openEditHoursModal = useCallback((target: HoursEntryTarget) => {
    setHoursModalState({ mode: 'edit', target });
  }, []);

  const closeHoursModal = useCallback(() => setHoursModalState(null), []);

  const submitHours = (input: SetHoursInput) => (
    actions.saveHours(
      input,
      hoursModalState?.mode === 'edit' ? hoursModalState.target.item.id : undefined,
    )
  );

  // Table configuration.
  const table = useHoursTable({
    canWrite,
    resourcesById: pageData.resourcesById,
    isEntryPending: actions.isEntryPending,
    onEdit: openEditHoursModal,
    onDelete: actions.requestDelete,
  });

  // View configuration.
  const selectedCycle = pageData.cycles.find(cycle => cycle.id === preferences.filters.cycleId) ?? null;
  const overviewCycle = selectedCycle
    ?? pageData.cycles.find(cycle => cycle.state === 'active')
    ?? pageData.cycles[0]
    ?? null;
  const hoursTable = (
    <HoursTable
      queryKey={HOURS_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      staffIds={preferences.filters.staffIds}
      categories={preferences.filters.categories}
      programIds={preferences.filters.programIds}
      types={preferences.filters.types}
      cycleId={preferences.filters.cycleId ?? undefined}
      search={preferences.search.appliedValue}
      sorting={preferences.table.sorting}
      columnWidths={preferences.table.columnWidths}
      selectedRowId={selection.selectedRowId}
      onRowSelect={selection.selectRow}
      onSortingChange={preferences.table.setSorting}
      onColumnWidthsChange={preferences.table.setColumnWidths}
      onErrorChange={setViewError}
    />
  );

  const hoursCalendar = (
    <HoursCalendar
      key={preferences.search.appliedValue}
      resources={pageData.resources}
      staffIds={preferences.filters.staffIds}
      categories={preferences.filters.categories}
      programIds={preferences.filters.programIds}
      types={preferences.filters.types}
      cycleId={preferences.filters.cycleId ?? ''}
      search={preferences.search.appliedValue}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaff?.id}
      calendarCacheRef={actions.calendarCacheRef}
      isEntryPending={actions.isEntryPending}
      onStaffSelect={selection.selectStaff}
      onEdit={openEditHoursModal}
      onDelete={actions.requestDelete}
      onAdd={openAddHoursModal}
      onMove={actions.moveHours}
      onErrorChange={setViewError}
    />
  );

  const viewContent = preferences.view === 'table'
    ? { table: hoursTable }
    : { calendar: hoursCalendar };

  // Render.
  return <>
    <main className="page-container page-container--data hours-page">
      <PageHeader
        title="Hours"
        actions={canWrite && pageData.writableResources.length ? <ActionsMenu
          triggerLabel="+ Add"
          ariaLabel="Add hours"
          items={[
            { id: 'session', label: 'Session Hours', onClick: () => openAddHoursModal({ source: 'session' }) },
            { id: 'task', label: 'Task Hours', onClick: () => openAddHoursModal({ source: 'task' }) },
            { id: 'regular', label: 'Regular Hours', onClick: () => openAddHoursModal({ source: 'regular' }) },
          ]}
        /> : undefined}

        search={preferences.ready ? <SearchInput
          label="Search hours"
          value={preferences.search.value}
          appliedValue={preferences.search.appliedValue}
          onChange={event => preferences.search.setValue(event.target.value)}
          onApply={preferences.search.apply}
          onClear={preferences.search.clear}
          placeholder="Search hours"
        /> : undefined}

        view={preferences.ready ? <ViewMenu
          label="View"
          value={preferences.view}
          onChange={preferences.setView}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'table', label: 'Table' }]}
        /> : undefined}

        columns={preferences.ready && preferences.view === 'table' ? <ColumnVisibilityMenu
          columns={table.columns}
          hiddenColumnKeys={preferences.table.hiddenColumns}
          onHiddenColumnKeysChange={preferences.table.setHiddenColumns}
        /> : undefined}

        filters={preferences.ready ? <FilterCard
          categories={preferences.filters.definitions}
          values={{
            staff: preferences.filters.staffIds,
            entryType: preferences.filters.categories,
            program: preferences.filters.programIds,
            type: preferences.filters.types,
            cycle: preferences.filters.cycleId ? [preferences.filters.cycleId] : [],
          }}
          onApply={preferences.filters.apply}
          onClearAll={preferences.filters.clear}
        /> : undefined}
      />
      <PageErrorOverlay errors={[
        pageData.optionsError ? {
          message: 'Could not load hour options.',
          details: 'Staff, programs, hour categories, and hour types could not be loaded.',
        } : null,
        pageData.cyclesError ? {
          message: 'Could not load program cycles.',
          details: 'Cycle filters and cycle-based totals may be unavailable.',
        } : null,
        preferences.error,
        actions.moveError,
        viewError,
        dashboardError,
      ]} />
      {!preferences.ready ? <p role="status">Loading saved filters…</p> : <PageBody
        ariaLabel="Hours overview and entries"
        dashboard={<HoursDashboard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
          cycle={overviewCycle}
          onErrorChange={setDashboardError}
        />}
        {...viewContent}
      />}
    </main>

    <HoursModal
      isOpen={hoursModalState !== null}
      resources={pageData.writableResources}
      programs={pageData.programs}
      categories={pageData.categories}
      loadTasks={getTaskDashboardData}
      onClose={closeHoursModal}
      onAdd={submitHours}
      initialResourceId={hoursModalState?.mode === 'edit'
        ? hoursModalState.target.resourceId
        : hoursModalState?.initialValues.resourceId ?? currentUserId}
      initialDate={hoursModalState?.mode === 'edit'
        ? hoursModalState.target.date
        : hoursModalState?.initialValues.date}
      initialSource={hoursModalState?.mode === 'add'
        ? hoursModalState.initialValues.source
        : undefined}
      canCompleteTask={canCompleteTask}
      staffLocked={hoursModalState?.mode === 'edit'
        || Boolean(hoursModalState?.initialValues.resourceId)}
      initialItem={hoursModalState?.mode === 'edit' ? hoursModalState.target.item : undefined}
    />

    <ConfirmModal
      action={actions.confirmAction}
      onClose={actions.closeConfirmation}
    />
  </>;
}
