import { useCallback, useMemo, useRef, useState, type ReactElement } from 'react';

import ActionsMenu from '../../../common/components/ActionsMenu/ActionsMenu';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import type { ConfirmAction } from '../../../common/components/ConfirmModal/types';
import HoursModal from './components/HoursModal/HoursModal';
import type { HoursFormTarget } from './components/HoursModal/hooks/useHoursModal';
import HoursCalendar from './components/HoursCalendar/HoursCalendar';
import HoursPayPeriodDashboardCard from './components/HoursDashboard/HoursPayPeriodDashboardCard/HoursPayPeriodDashboardCard';
import HoursCycleSummaryDashboardCard from './components/HoursDashboard/HoursCycleSummaryDashboardCard/HoursCycleSummaryDashboardCard';
import HoursTable from './components/HoursTable/HoursTable';

import { useAuth } from '../../../auth/authContext';
import { getUser } from '../../../auth/storage';
import useHoursTable from './components/HoursTable/hooks/useHoursTable';
import useHoursActions from './hooks/actions/useHoursActions';
import useHoursReferenceData from './hooks/data/useHoursReferenceData';
import useHoursPreferences from './hooks/preferences/useHoursPreferences';
import useHoursSelection from './hooks/selection/useHoursSelection';

import { getOpenTasks } from '../Tasks/api/tasks.api';
import { HOURS_TABLE_KEYS, type AddHoursFormContext, type Hours, type HoursActions, type HoursCalendarIndex } from './types';

// Page-owned cache contracts.
const TASK_QUERY_KEY = ['tasks'] as const;
const HOURS_QUERY_KEY = ['hours'] as const;
const HOURS_TABLE_QUERY_KEY = [...HOURS_QUERY_KEY, 'table'] as const;

/**
 * Composes page-owned Hours choices with independent body and dashboard queries.
 * @example <Hours /> // table/calendar rows with staff summaries
 */
export default function HoursPage(): ReactElement {
  // Permissions.
  const { permissions } = useAuth();
  const currentUserId = getUser()?.id;
  const canWrite = permissions.includes('write:hours');
  const canCompleteTask = permissions.includes('write:tasks');

  // Reference data and preferences.
  const referenceData = useHoursReferenceData();
  const { staff, programs, cycles, hoursOptions } = referenceData;
  const staffRows = staff.data ?? [];
  const writableStaff = useMemo(
    () => (staff.data ?? []).filter(staffMember => staffMember.writable),
    [staff.data],
  );
  const preferences = useHoursPreferences(referenceData, HOURS_TABLE_KEYS);

  const [hoursModalTarget, setHoursModalTarget] = useState<HoursFormTarget | null>(null);
  const calendarIndexRef = useRef<HoursCalendarIndex | null>(null);

  const syncHoursView = useCallback((item: Hours) => {
    calendarIndexRef.current?.upsert(item);
  }, []);

  const removeHoursFromViews = useCallback((itemId: Hours['id']) => {
    calendarIndexRef.current?.remove(itemId);
    setHoursModalTarget(current => (
      current?.mode === 'edit' && current.item.id === itemId ? null : current
    ));
  }, []);

  // Selection and actions.
  const selection = useHoursSelection({
    staff: staffRows,
    currentUserId,
  });

  const actions = useHoursActions({
    hoursQueryKey: HOURS_QUERY_KEY,
    hoursTableQueryKey: HOURS_TABLE_QUERY_KEY,
    taskQueryKey: TASK_QUERY_KEY,
    filters: preferences.appliedFilters,
    onItemChanged: syncHoursView,
    onItemRemoved: removeHoursFromViews,
  });

  const editedItem = hoursModalTarget?.mode === 'edit' ? hoursModalTarget.item : undefined;

  // Hours modal.
  const openAddHoursModal = useCallback((context: Partial<AddHoursFormContext>) => {
    setHoursModalTarget({ mode: 'add', context });
  }, []);

  const openEditHoursModal = useCallback((target: Hours) => {
    setHoursModalTarget({ mode: 'edit', item: target });
  }, []);

  const closeHoursModal = useCallback(() => setHoursModalTarget(null), []);

  const submitHours = (input: Partial<Hours>, completeTask: boolean) => (
    actions.saveHours(input, editedItem, completeTask)
  );

  const [confirmation, setConfirmation] = useState<ConfirmAction | null>(null);
  const { deleteHours, isItemPending, moveHours } = actions;
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
  const hoursActions = useMemo<HoursActions>(() => ({
    isItemPending,
    add: openAddHoursModal,
    edit: openEditHoursModal,
    move: moveHours,
    requestDelete,
  }), [isItemPending, moveHours, openAddHoursModal, openEditHoursModal, requestDelete]);

  const table = useHoursTable({
    canWrite,
    staff: staff.data,
    actions: hoursActions
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
    />
  );

  const hoursCalendar = (
    <HoursCalendar
      key={JSON.stringify(preferences.appliedFilters)}
      staff={staffRows}
      filters={preferences.appliedFilters}
      canWrite={canWrite}
      selectedStaffId={selection.selectedStaff?.id}
      calendarIndexRef={calendarIndexRef}
      actions={hoursActions}
      onStaffSelect={selection.selectStaff}
    />
  );

  const viewUnavailable = cycles.error ? <p>Cycles unavailable.</p> : <p>No cycles available.</p>;
  const hasCycleBounds = Boolean(preferences.appliedFilters.dateRange) && !cycles.error;
  const optionsError = hoursOptions.error || staff.error || programs.error;

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
        cycles.error ? {
          message: 'Could not load program cycles.',
          details: 'Cycle filters and cycle-based totals may be unavailable.',
        } : null,
        preferences.error,
        actions.moveError,
      ]}
      dashboard={<>
        <HoursPayPeriodDashboardCard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
        />
        <HoursCycleSummaryDashboardCard
          queryKey={HOURS_QUERY_KEY}
          staff={selection.selectedStaff}
          cycles={cycles.data ?? []}
        />
      </>}
      table={hasCycleBounds ? hoursTable : viewUnavailable}
      calendar={hasCycleBounds ? hoursCalendar : viewUnavailable}
    />

    <HoursModal
      target={hoursModalTarget}
      staff={writableStaff}
      programs={programs.data ?? []}
      categories={hoursOptions.data?.categories ?? []}
      loadTasks={getOpenTasks}
      onClose={closeHoursModal}
      onSave={submitHours}
      canCompleteTask={canCompleteTask}
    />

    <ConfirmModal
      action={confirmation}
      onClose={closeConfirmation}
    />
  </>;
}
