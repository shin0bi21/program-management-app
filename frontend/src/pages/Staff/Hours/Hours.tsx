import { useCallback, useRef, useState, type ReactElement } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import type { ConfirmAction } from '../../../common/components/ConfirmModal/types';
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

import { getOpenTasks } from '../Tasks/api/tasks.api';
import { HOURS_TABLE_KEYS, type AddHoursFormContext, type Hours, type HoursCalendarIndex } from './types';

type HoursModalState =
  | { mode: 'add'; context: Partial<AddHoursFormContext> }
  | { mode: 'edit'; item: Hours }
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
export default function HoursPage(): ReactElement {
  const [viewError, setViewError] = useState<PageMessageValue>(null);

  // Permissions.
  const { permissions } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:hours');
  const canCompleteTask = permissions.includes('write:tasks');

  // Page data and preferences.
  const pageData = useHoursData(
    HOURS_REFERENCE_DATA_QUERY_KEY,
    currentUserId,
  );

  const preferences = useHoursPreferences(pageData, HOURS_TABLE_KEYS);

  const [hoursModalState, setHoursModalState] = useState<HoursModalState>(null);
  const calendarIndexRef = useRef<HoursCalendarIndex | null>(null);

  const syncHoursView = useCallback((item: Hours) => {
    calendarIndexRef.current?.upsert(item);
  }, []);

  const removeHoursFromViews = useCallback((itemId: Hours['id']) => {
    calendarIndexRef.current?.remove(itemId);
    setHoursModalState(current => (
      current?.mode === 'edit' && current.item.id === itemId ? null : current
    ));
  }, []);

  // Selection and actions.
  const selection = useHoursSelection({
    staff: pageData.staff.data ?? [],
    currentUserStaff: pageData.currentUserStaff,
  });

  const actions = useHoursActions({
    hoursQueryKey: HOURS_QUERY_KEY,
    hoursTableQueryKey: HOURS_TABLE_QUERY_KEY,
    taskQueryKey: TASK_QUERY_KEY,
    filters: preferences.appliedFilters,
    onItemChanged: syncHoursView,
    onItemRemoved: removeHoursFromViews,
  });

  const editedItem = hoursModalState?.mode === 'edit' ? hoursModalState.item : undefined;
  const addHoursFormContext = hoursModalState?.mode === 'add' ? hoursModalState.context : undefined;

  // Hours modal.
  const openAddHoursModal = useCallback((context: Partial<AddHoursFormContext>) => {
    setHoursModalState({ mode: 'add', context });
  }, []);

  const openEditHoursModal = useCallback((target: Hours) => {
    setHoursModalState({ mode: 'edit', item: target });
  }, []);

  const closeHoursModal = useCallback(() => setHoursModalState(null), []);

  const submitHours = (input: Partial<Hours>, completeTask: boolean) => (
    actions.saveHours(input, editedItem, completeTask)
  );

  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const deleteHours = actions.deleteHours;
  const requestDelete = useCallback((target: Hours) => {
    setConfirmation({
      title: 'Delete logged hours',
      message: `Delete these ${target.categoryLabel.toLowerCase()} hours?`,
      confirmVariant: 'danger',
      onConfirm: () => deleteHours(target),
    });
  }, [deleteHours]);
  const closeConfirmation = () => setConfirmation(null);

  // Table configuration.
  const table = useHoursTable({
    canWrite,
    staffById: pageData.staffById,
    isItemPending: actions.isItemPending,
    onEdit: openEditHoursModal,
    onDelete: requestDelete,
  });

  // View configuration.
  const hoursTable = (
    <HoursTable
      queryKey={HOURS_TABLE_QUERY_KEY}
      columns={table.columns}
      hiddenColumnKeys={preferences.table.hiddenColumns}
      filters={preferences.appliedFilters}
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
      key={JSON.stringify(preferences.appliedFilters)}
      staff={pageData.staff.data ?? []}
      filters={preferences.appliedFilters}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaff?.id}
      calendarIndexRef={calendarIndexRef}
      isItemPending={actions.isItemPending}
      onStaffSelect={selection.selectStaff}
      onEdit={openEditHoursModal}
      onDelete={requestDelete}
      onAdd={openAddHoursModal}
      onMove={actions.moveHours}
      onMessageChange={setViewError}
    />
  );

  const viewUnavailable = pageData.cycles.error ? <p>Cycles unavailable.</p> : <p>No cycles available.</p>;
  const hasCycleBounds = Boolean(preferences.appliedFilters.dateRange) && !pageData.cycles.error;
  const optionsError = pageData.referenceData.error || pageData.staff.error || pageData.programs.error;

  // Render.
  return <>
    <PageContainer
      className="hours-page"
      ariaLabel="Hours overview and records"
      controls={preferences}
      loadingSpinner
      title="Hours"
      actions={canWrite ? <ActionsMenu
        triggerLabel="+ Add"
        ariaLabel="Add hours"
        items={[
          { id: 'session', label: 'Session Hours', onClick: () => openAddHoursModal({ type: 'session' }) },
          { id: 'task', label: 'Task Hours', onClick: () => openAddHoursModal({ type: 'task' }) },
          { id: 'regular', label: 'Regular Hours', onClick: () => openAddHoursModal({ type: 'regular' }) },
        ]}
      /> : undefined}

      search={{ label: 'Search hours', placeholder: 'Search hours' }}
      columns={table.columns}
      messages={[
        optionsError ? {
          message: 'Could not load hour options.',
          details: 'Staff, programs, hour categories, and hour types could not be loaded.',
        } : null,
        pageData.cycles.error ? {
          message: 'Could not load program cycles.',
          details: 'Cycle filters and cycle-based totals may be unavailable.',
        } : null,
        preferences.error,
        actions.moveError,
        viewError,
      ]}
      dashboard={<>
        <HoursPayPeriodDashboardCard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
        />
        <HoursCycleSummaryDashboardCard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
          cycles={pageData.cycles.data ?? []}
        />
      </>}
      table={hasCycleBounds ? hoursTable : viewUnavailable}
      calendar={hasCycleBounds ? hoursCalendar : viewUnavailable}
    />

    <HoursModal
      isOpen={hoursModalState !== null}
      staff={pageData.writableStaff}
      programs={pageData.programs.data ?? []}
      categories={pageData.referenceData.data?.categories ?? []}
      loadTasks={getOpenTasks}
      onClose={closeHoursModal}
      onAdd={submitHours}
      staffId={addHoursFormContext?.staffId}
      date={addHoursFormContext?.date}
      type={addHoursFormContext?.type}
      canCompleteTask={canCompleteTask}
      item={editedItem}
    />

    <ConfirmModal
      action={confirmation}
      onClose={closeConfirmation}
    />
  </>;
}
