import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { StaffReference, Hours } from '../../../types';
import { formatShortDate } from '../../../../../../common/utils/date';
import { HOURS_ITEM_TYPE_LABELS } from '../../../utils/hoursItemType';
import HoursTypeLabel from '../../HoursTypeLabel/HoursTypeLabel';

/**
 * Builds hours columns with notes capped at 160px and actions for writable, settled entries.
 * @param options - Staff permissions, pending-entry state, and edit/delete callbacks.
 * @example A long note scrolls within its cell while a pending entry has no actions.
 */
export default function useHoursTable({
  canWrite,
  staffById,
  isItemPending,
  onEdit,
  onDelete,
}: {
  canWrite: boolean;
  staffById: ReadonlyMap<string, StaffReference>;
  isItemPending: (itemId: string) => boolean;
  onEdit: (target: Hours) => void;
  onDelete: (target: Hours) => void;
}) {
  const columns = useMemo<TableColumnDef<Hours>[]>(() => {
    /**
     * Displays edit/delete actions when the entry's staff member is writable and the entry is settled.
     * @param row - Hours entry and its owning staff member.
     * @example An entry belonging to a read-only staffMember returns null.
     */
    function renderActionsMenu(row: Hours) {
      if (!staffById.get(row.staffId)?.writable || isItemPending(row.id)) return null;
      return <ActionsMenu
        ariaLabel={`Actions for ${row.taskTitle ?? row.categoryLabel} on ${row.date}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => onEdit(row) },
          { id: 'delete', label: 'Delete', variant: 'danger', onClick: () => onDelete(row) },
        ]}
      />;
    }

    return [
      { id: 'firstName', header: 'First Name', accessorFn: row => row.firstName },
      { id: 'lastName', header: 'Last Name', accessorFn: row => row.lastName },
      { id: 'date', header: 'Date', size: 140, accessorFn: row => formatShortDate(row.date) },
      { id: 'cycle', header: 'Cycle', accessorFn: row => row.cycle ?? '—' },
      { id: 'program', header: 'Program', accessorFn: row => row.program ?? '—' },
      { id: 'category', header: 'Category', accessorFn: row => row.categoryLabel },
      { id: 'hours', header: 'Hours', size: 100, accessorFn: row => row.hours },
      {
        id: 'note',
        header: 'Note',
        accessorFn: row => row.note,
        cell: ({ row }) => (
          <div style={{ maxHeight: 160, overflowY: 'auto' }}>{row.original.note}</div>
        ),
      },
      { id: 'type', header: 'Type', size: 110,
        accessorFn: row => HOURS_ITEM_TYPE_LABELS[row.type],
        cell: ({ row }) => <HoursTypeLabel item={row.original} />,
      },
      ...(canWrite ? [{
        id: 'actions',
        header: '',
        size: 40,
        enableResizing: false,
        enableHiding: false,
        cell: ({ row }: { row: { original: Hours } }) => renderActionsMenu(row.original),
      }] : []),
    ];
  }, [canWrite, isItemPending, onDelete, onEdit, staffById]);

  return { columns };
}
