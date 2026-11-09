import { useCallback, useMemo, useState } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type PageMessageValue } from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import HoursModal from './components/HoursModal/HoursModal';
import HoursCalendar from './components/HoursCalendar/HoursCalendar';
import HoursPayPeriodDashboardCard from './components/HoursDashboard/HoursPayPeriodDashboardCard/HoursPayPeriodDashboardCard';
import HoursCycleSummaryDashboardCard from './components/HoursDashboard/HoursCycleSummaryDashboardCard/HoursCycleSummaryDashboardCard';
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
import { HOURS_TABLE_KEYS, type HoursItem, type HoursFilters } from './types';

import './Hours.css';

type HoursAddTarget = {
  staffId?: string;
  date?: string;
  source?: 'regular' | 'task' | 'session';
};

type HoursModalState =
  | { mode: 'add'; initialValues: HoursAddTarget }
  | { mode: 'edit'; item: HoursItem }
  | null;

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;
const HOURS_TABLE_QUERY_KEY = [...HOURS_QUERY_KEY, 'table'] as const;
const HOURS_REFERENCE_DATA_QUERY_KEY = ['hours-reference-data'] as const;

/**
 * Composes page-owned Hours choices with independent body and dashboard queries.
 * @example <Hours /> // table/calendar rows with staff summaries
 */
export default function Hours() {
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions.
  const { permissions, role } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:hours');
  const canCompleteTask = permissions.includes('write:tasks');

  // Page data and preferences.
  const pageData = useHoursData(
    HOURS_REFERENCE_DATA_QUERY_KEY,
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
    optionsError: Boolean(pageData.localOptionsError),
    resourcesError: Boolean(pageData.resourcesError),
    programsError: Boolean(pageData.programsError),
    cyclesError: Boolean(pageData.cyclesError),
    tableKeys: HOURS_TABLE_KEYS,
  });

  // Filter configuration.
  const hoursFilters = useMemo<HoursFilters>(() => ({
    dateRange: preferences.filters.dateRange,
    staffIds: preferences.filters.values.staffIds,
    categories: preferences.filters.values.categories,
    programIds: preferences.filters.values.programIds,
    types: preferences.filters.values.types,
    cycleIds: preferences.filters.values.cycleIds,
    search: preferences.search.appliedValue,
  }), [
    preferences.filters.dateRange,
    preferences.filters.values.categories,
    preferences.filters.values.cycleIds,
    preferences.filters.values.programIds,
    preferences.filters.values.staffIds,
    preferences.filters.values.types,
    preferences.search.appliedValue,
  ]);

  const [hoursModalState, setHoursModalState] = useState<HoursModalState>(null);

  // Keep table action cells mounted when preferences or page data refresh.
  const closeRemovedItem = useCallback((itemId: string) => {
    setHoursModalState(current => (
      current?.mode === 'edit' && current.item.id === itemId ? null : current
    ));
  }, []);

  // Selection and actions.
  const selection = useHoursSelection({
    resources: pageData.resources,
    currentUserResource: pageData.currentUserResource,
  });

  const actions = useHoursActions({
    hoursQueryKey: HOURS_QUERY_KEY,
    hoursTableQueryKey: HOURS_TABLE_QUERY_KEY,
    taskQueryKey: TASK_QUERY_KEY,
    onItemRemoved: closeRemovedItem,
  });

  const editedItem = hoursModalState?.mode === 'edit' ? hoursModalState.item : undefined;
  const addHoursContext = hoursModalState?.mode === 'add' ? hoursModalState.initialValues : undefined;

  // Hours modal.
  const openAddHoursModal = useCallback((initialValues: HoursAddTarget) => {
    setHoursModalState({ mode: 'add', initialValues });
  }, []);

  const openEditHoursModal = useCallback((target: HoursItem) => {
    setHoursModalState({ mode: 'edit', item: target });
  }, []);

  const closeHoursModal = useCallback(() => setHoursModalState(null), []);

  const submitHours = (input: SetHoursInput) => actions.saveHours(input, editedItem?.id);

  // Table configuration.
  const table = useHoursTable({
    canWrite,
    resourcesById: pageData.resourcesById,
    isItemPending: actions.isItemPending,
    onEdit: openEditHoursModal,
    onDelete: actions.requestDelete,
  });

  // View configuration.
  const dashboardCycle = pageData.cycles.find(cycle => cycle.id === selection.dashboardCycleId);
  const firstFilteredCycle = pageData.cycles.find(cycle => preferences.filters.values.cycleIds.includes(cycle.id));
  const overviewCycle = dashboardCycle
    ?? firstFilteredCycle
    ?? pageData.cycles.find(cycle => cycle.state === 'active')
    ?? pageData.cycles[0]
    ?? null;
  const hoursTable = (
    <HoursTable
      queryKey={HOURS_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      filters={hoursFilters}
      sorting={preferences.table.sorting}
      columnWidths={preferences.table.columnWidths}
      selectedRowId={selection.selectedRowId}
      onRowSelect={selection.selectRow}
      onSortingChange={preferences.table.setSorting}
      onColumnWidthsChange={preferences.table.setColumnWidths}
      onMessageChange={setViewError}
    />
  );

  const hoursCalendar = (
    <HoursCalendar
      key={JSON.stringify(hoursFilters)}
      resources={pageData.resources}
      filters={hoursFilters}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaff?.id}
      calendarIndexRef={actions.calendarIndexRef}
      isItemPending={actions.isItemPending}
      onStaffSelect={selection.selectStaff}
      onEdit={openEditHoursModal}
      onDelete={actions.requestDelete}
      onAdd={openAddHoursModal}
      onMove={actions.moveHours}
      onMessageChange={setViewError}
    />
  );

  const viewUnavailable = pageData.cyclesError ? <p>Cycles unavailable.</p> : <p>No cycles available.</p>;
  const hasCycleBounds = Boolean(hoursFilters.dateRange) && !pageData.cyclesError;

  // Render.
  return <>
    <PageContainer
      className="hours-page"
      ariaLabel="Hours overview and records"
      controls={preferences}
      loadingSpinner
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

      search={{ label: 'Search hours', placeholder: 'Search hours' }}
      columns={table.columns}
      messages={[
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
      ]}
      dashboard={<>
        <HoursPayPeriodDashboardCard queryKey={HOURS_QUERY_KEY} staff={selection.selectedStaff} />
        <HoursCycleSummaryDashboardCard queryKey={HOURS_QUERY_KEY} staff={selection.selectedStaff} cycle={overviewCycle} />
      </>}
      table={hasCycleBounds ? hoursTable : viewUnavailable}
      calendar={hasCycleBounds ? hoursCalendar : viewUnavailable}
    />

    <HoursModal
      isOpen={hoursModalState !== null}
      resources={pageData.writableResources}
      programs={pageData.programs}
      categories={pageData.categories}
      loadTasks={getTaskDashboardData}
      onClose={closeHoursModal}
      onAdd={submitHours}
      initialStaffId={addHoursContext?.staffId ?? currentUserId}
      initialDate={addHoursContext?.date}
      initialSource={addHoursContext?.source}
      canCompleteTask={canCompleteTask}
      staffLocked={Boolean(editedItem || addHoursContext?.staffId)}
      initialItem={editedItem}
    />

    <ConfirmModal
      action={actions.confirmAction}
      onClose={actions.closeConfirmation}
    />
  </>;
}
