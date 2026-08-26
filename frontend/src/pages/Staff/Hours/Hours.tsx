import { useCallback, useState } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import PageBody from '../../../common/components/PageBody/PageBody';
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
import useHoursActions from './hooks/useHoursActions';
import useHoursData from './hooks/useHoursData';
import useHoursFilters from './hooks/useHoursFilters';
import useHoursPreferences from './hooks/useHoursPreferences';
import useHoursSelection from './hooks/useHoursSelection';

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

function getHoursError(
  optionsError: unknown,
  cyclesError: unknown,
  preferenceError: string | null,
) {
  return (optionsError ? 'Could not load hour options.' : '')
    || (cyclesError ? 'Could not load cycles.' : '')
    || preferenceError;
}

export default function Hours() {
  // Permissions.
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:hours');
  const canCompleteTask = permissions.includes('write:tasks');

  // Modal state.
  const [hoursModalState, setHoursModalState] = useState<HoursModalState>(null);

  // Page data and persisted controls.
  const pageData = useHoursData(
    HOURS_REFERENCE_DATA_QUERY_KEY,
    PROGRAM_CYCLES_QUERY_KEY,
    currentUserId,
  );

  const hoursPreferences = useHoursPreferences({
    role,
    resources: pageData.resources,
    programs: pageData.programs,
    cycles: pageData.cycles,
    loadingDependencies: pageData.optionsLoading || pageData.cyclesLoading,
    optionsError: Boolean(pageData.optionsError),
    cyclesError: Boolean(pageData.cyclesError),
    tableKeys: HOURS_TABLE_KEYS,
  });

  const filters = useHoursFilters({
    role,
    preferences: hoursPreferences.preferences,
    resources: pageData.resources,
    programs: pageData.programs,
    categories: pageData.categories,
    types: pageData.types,
    cycles: pageData.cycles,
    updatePreferences: hoursPreferences.updatePreferences,
  });

  const view = hoursPreferences.preferences.view;

  // Selection, actions, and modal workflows.
  const selection = useHoursSelection({
    resources: pageData.resources,
    currentUserResource: pageData.currentUserResource,
    cycleId: filters.cycleId,
    onCycleSelect: filters.selectCycle,
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

  const openAddHoursModal = useCallback((initialValues: HoursAddTarget) => {
    setHoursModalState({ mode: 'add', initialValues });
  }, []);

  const openEditHoursModal = useCallback((target: HoursEntryTarget) => {
    setHoursModalState({ mode: 'edit', target });
  }, []);

  const closeHoursModal = useCallback(() => setHoursModalState(null), []);

  const table = useHoursTable({
    canWrite,
    resourcesById: pageData.resourcesById,
    isEntryPending: actions.isEntryPending,
    onEdit: openEditHoursModal,
    onDelete: actions.requestDelete,
  });

  // View configuration.
  const selectedCycle = pageData.cycles.find(cycle => cycle.id === filters.cycleId) ?? null;
  const overviewCycle = selectedCycle
    ?? pageData.cycles.find(cycle => cycle.state === 'active')
    ?? pageData.cycles[0]
    ?? null;
  const hoursError = getHoursError(
    pageData.optionsError,
    pageData.cyclesError,
    hoursPreferences.error,
  );
  const hoursTable = (
    <HoursTable
      queryKey={HOURS_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={hoursPreferences.preferences.hiddenColumns}
      staffIds={filters.staffIds}
      categories={filters.categories}
      programIds={filters.programIds}
      types={filters.types}
      cycleId={filters.cycleId ?? undefined}
      search={filters.appliedSearch}
      sorting={hoursPreferences.preferences.sorting}
      columnWidths={hoursPreferences.preferences.columnWidths}
      selectedRowId={selection.selectedRowId}
      onRowSelect={selection.selectRow}
      onSortingChange={hoursPreferences.updateSorting}
      onColumnWidthsChange={hoursPreferences.updateColumnWidths}
    />
  );

  const hoursCalendar = (
    <HoursCalendar
      resources={pageData.resources}
      staffIds={filters.staffIds}
      categories={filters.categories}
      programIds={filters.programIds}
      types={filters.types}
      cycleId={filters.cycleId ?? ''}
      canWrite={canWrite}
      moveError={actions.moveError}
      selectedStaffId={selection.selectedStaff?.id}
      calendarCacheRef={actions.calendarCacheRef}
      isEntryPending={actions.isEntryPending}
      onStaffSelect={selection.selectStaff}
      onEdit={openEditHoursModal}
      onDelete={actions.requestDelete}
      onAdd={openAddHoursModal}
      onMove={actions.moveHours}
    />
  );

  const viewContent = view === 'table'
    ? { table: hoursTable }
    : { calendar: hoursCalendar };

  const submitHours = (input: SetHoursInput) => (
    actions.saveHours(
      input,
      hoursModalState?.mode === 'edit' ? hoursModalState.target.item.id : undefined,
    )
  );

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

        search={hoursPreferences.ready && view === 'table' ? <SearchInput
          label="Search hours"
          value={filters.search}
          appliedValue={filters.appliedSearch}
          onChange={event => filters.setSearch(event.target.value)}
          onApply={filters.applySearch}
          onClear={filters.clearSearch}
          placeholder="Search hours"
        /> : undefined}

        view={hoursPreferences.ready ? <ViewMenu
          label="View"
          value={view}
          onChange={nextView => hoursPreferences.updatePreferences({ view: nextView })}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'table', label: 'Table' }]}
        /> : undefined}

        columns={hoursPreferences.ready && view === 'table' ? <ColumnVisibilityMenu
          columns={table.columns}
          hiddenColumnKeys={hoursPreferences.preferences.hiddenColumns}
          onHiddenColumnKeysChange={hoursPreferences.updateHiddenColumns}
        /> : undefined}

        filters={hoursPreferences.ready ? <FilterCard
          categories={filters.filterCategories}
          values={{
            staff: filters.staffIds,
            entryType: filters.categories,
            program: filters.programIds,
            type: filters.types,
            cycle: filters.cycleId ? [filters.cycleId] : [],
          }}
          onApply={filters.applyFilter}
          onClearAll={filters.clearFilters}
        /> : undefined}
      />
      {hoursError && <p className="hours-page__error" role="alert">{hoursError}</p>}
      {!hoursPreferences.ready ? <p role="status">Loading saved filters…</p> : <PageBody
        ariaLabel="Hours overview and entries"
        dashboard={<HoursDashboard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
          cycle={overviewCycle}
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
