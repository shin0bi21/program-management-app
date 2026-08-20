import { useCallback, useState } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import ColumnVisibilityMenu from '../../../common/components/ColumnVisibilityMenu/ColumnVisibilityMenu';
import FilterCard from '../../../common/components/FilterCard/FilterCard';
import Modal from '../../../common/components/Modal/Modal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageHeader from '../../../common/components/PageHeader/PageHeader';
import SearchInput from '../../../common/components/SearchInput/SearchInput';
import ViewMenu from '../../../common/components/ViewMenu/ViewMenu';
import HoursModal from '../../../common/features/hours/components/HoursModal/HoursModal';
import HoursCalendarView from './components/HoursCalendarView/HoursCalendarView';
import HoursDashboard from './components/HoursDashboard/HoursDashboard';
import HoursTableView from './components/HoursTableView/HoursTableView';

import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import { useConfirmModal } from '../../../common/components/Modal/hooks/useConfirmModal';
import useHoursTable from './components/HoursTableView/hooks/useHoursTable';
import useHoursActions from './hooks/useHoursActions';
import useHoursData from './hooks/useHoursData';
import useHoursFilters from './hooks/useHoursFilters';
import useHoursPreferences from './hooks/useHoursPreferences';
import useHoursSelection from './hooks/useHoursSelection';

import type { SetHoursInput } from '../../../common/features/hours/hours.api';
import type { HoursModalState, HoursAddTarget, HoursEntryTarget } from './types';

import './Hours.css';

// Page-owned cache and persisted-column contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;
const HOURS_LIST_QUERY_KEY = [...HOURS_QUERY_KEY, 'list'] as const;
const HOURS_OPTIONS_QUERY_KEY = ['hours-options'] as const;
const PROGRAM_CYCLES_QUERY_KEY = ['program-cycles'] as const;

const HOURS_COLUMN_KEYS = [
  'date',
  'firstName',
  'lastName',
  'program',
  'cycle',
  'category',
  'session',
  'hours',
  'note',
  'type',
] as const;
const HOURS_SORT_KEYS = [
  'firstName', 'lastName', 'date', 'program', 'cycle', 'category', 'session', 'hours', 'note', 'type',
] as const;

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
    HOURS_OPTIONS_QUERY_KEY,
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
    columnKeys: HOURS_COLUMN_KEYS,
    sortKeys: HOURS_SORT_KEYS,
  });

  const filters = useHoursFilters({
    role,
    preferences: hoursPreferences.preferences,
    resources: pageData.resources,
    programs: pageData.programs,
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
    hoursListQueryKey: HOURS_LIST_QUERY_KEY,
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
    preferences: hoursPreferences.preferences,
    updatePreferences: hoursPreferences.updatePreferences,
    isEntryPending: actions.isEntryPending,
    onEdit: openEditHoursModal,
    onDelete: actions.requestDelete,
  });

  const confirmModal = useConfirmModal({
    action: actions.confirmAction,
    onClose: actions.closeConfirmation,
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
  const hoursTableView = (
    <HoursTableView
      queryKey={HOURS_LIST_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={table.hiddenColumns}
      staffIds={filters.staffIds}
      categories={filters.categories}
      programIds={filters.programIds}
      types={filters.types}
      cycleId={filters.cycleId ?? undefined}
      search={filters.search}
      sorting={table.sorting}
      columnWidths={table.columnWidths}
      selectedRowId={selection.selectedRowId}
      onRowSelect={selection.selectRow}
      onSortingChange={table.updateSorting}
      onColumnWidthsChange={table.updateColumnWidths}
    />
  );

  const hoursCalendarView = (
    <HoursCalendarView
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

  const viewContent = view === 'list'
    ? { table: hoursTableView }
    : { calendar: hoursCalendarView };

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

        search={hoursPreferences.ready && view === 'list' ? <SearchInput
          label="Search hours"
          value={filters.search}
          onChange={event => filters.setSearch(event.target.value)}
          placeholder="Search hours"
        /> : undefined}

        view={hoursPreferences.ready ? <ViewMenu
          label="View"
          value={view}
          onChange={nextView => hoursPreferences.updatePreferences({ view: nextView })}
          options={[{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }]}
        /> : undefined}

        columns={hoursPreferences.ready && view === 'list' ? <ColumnVisibilityMenu
          columns={table.columns}
          hiddenColumnKeys={table.hiddenColumns}
          onHiddenColumnKeysChange={table.updateHiddenColumns}
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

    <Modal
      isOpen={actions.confirmAction !== null}
      onClose={actions.closeConfirmation}
      title={actions.confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {actions.confirmAction && <p>{actions.confirmAction.message}</p>}
    </Modal>
  </>;
}
