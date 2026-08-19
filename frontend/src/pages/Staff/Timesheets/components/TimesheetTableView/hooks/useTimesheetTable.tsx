import { useCallback, useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumn } from '../../../../../../common/components/Table/Table';
import type { StaffResource, TimesheetItem } from '../../../../../../common/features/timeEntries/types';
import type { ListSort } from '../../../../../../common/types/pagination';
import { formatShortDate } from '../../../../../../common/utils/date';

import type {
  TimesheetEntryTarget,
  TimesheetListRow,
  TimesheetPreferences,
  TimesheetSortKey,
} from '../../../types';

function getEntryTypeLabel(item: TimesheetItem) {
  return item.taskId ? 'Task' : item.sessionId ? 'Session' : 'Regular';
}

export default function useTimesheetTable({
  canWrite,
  resourcesById,
  preferences,
  updatePreferences,
  isEntryPending,
  onEdit,
  onDelete,
}: {
  canWrite: boolean;
  resourcesById: ReadonlyMap<string, StaffResource>;
  preferences: TimesheetPreferences;
  updatePreferences: (patch: Partial<TimesheetPreferences>) => void;
  isEntryPending: (entryId: string) => boolean;
  onEdit: (target: TimesheetEntryTarget) => void;
  onDelete: (target: TimesheetEntryTarget) => void;
}) {
  const columns = useMemo<TableColumn<TimesheetListRow>[]>(() => [
    { key: 'firstName', sortKey: 'firstName', header: 'First Name', render: row => row.staffFirstName },
    { key: 'lastName', sortKey: 'lastName', header: 'Last Name', render: row => row.staffLastName },
    { key: 'date', sortKey: 'date', header: 'Date', width: 140, render: row => formatShortDate(row.date) },
    { key: 'cycle', sortKey: 'cycle', header: 'Cycle', render: row => row.item.cycleName ?? '—' },
    { key: 'program', sortKey: 'program', header: 'Program', render: row => row.item.programName ?? '—' },
    { key: 'category', sortKey: 'category', header: 'Category', render: row => row.item.categoryLabel },
    { key: 'session', sortKey: 'session', header: 'Session', render: row => row.item.sessionLabel ?? '—' },
    { key: 'hours', sortKey: 'hours', header: 'Hours', width: 100, render: row => row.item.hours },
    { key: 'note', sortKey: 'note', header: 'Note', render: row => row.item.note },
    { key: 'type', sortKey: 'type', header: 'Type', width: 110, render: row => {
      const label = getEntryTypeLabel(row.item);
      return <span className={`time-item__type time-item__type--${label.toLowerCase()}`}>{label}</span>;
    } },
    ...(canWrite ? [{
      key: 'actions',
      header: '',
      width: 40,
      resizable: false,
      className: 'col-actions',
      render: (row: TimesheetListRow) => resourcesById.get(row.resourceId)?.writable
        && !isEntryPending(row.id) ? <ActionsMenu
        ariaLabel={`Actions for ${row.item.taskTitle ?? row.item.categoryLabel} on ${row.date}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => onEdit(row) },
          { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => onDelete(row) },
        ]}
      /> : null,
    }] : []),
  ], [canWrite, isEntryPending, onDelete, onEdit, resourcesById]);

  const updateSorting = useCallback(
    (sorting: ListSort<TimesheetSortKey>) => updatePreferences({ sorting }),
    [updatePreferences],
  );
  const updateColumnWidths = useCallback(
    (columnWidths: Record<string, number>) => updatePreferences({ columnWidths }),
    [updatePreferences],
  );
  const updateHiddenColumns = useCallback(
    (hiddenColumns: string[]) => updatePreferences({ hiddenColumns }),
    [updatePreferences],
  );

  return {
    columns,
    sorting: preferences.sorting,
    columnWidths: preferences.columnWidths,
    hiddenColumns: preferences.hiddenColumns,
    updateSorting,
    updateColumnWidths,
    updateHiddenColumns,
  };
}
