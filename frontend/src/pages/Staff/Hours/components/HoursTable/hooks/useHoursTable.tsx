import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { StaffResource, HoursTableRow } from '../../../types';
import { formatShortDate } from '../../../../../../common/utils/date';
import type { HoursEntryTarget } from '../../../types';
import { getHoursEntryType, HOURS_ENTRY_TYPE_LABELS } from '../../../utils/hoursEntryType';
import HoursTypeLabel from '../../HoursTypeLabel/HoursTypeLabel';

export default function useHoursTable({
  canWrite,
  resourcesById,
  isEntryPending,
  onEdit,
  onDelete,
}: {
  canWrite: boolean;
  resourcesById: ReadonlyMap<string, StaffResource>;
  isEntryPending: (entryId: string) => boolean;
  onEdit: (target: HoursEntryTarget) => void;
  onDelete: (target: HoursEntryTarget) => void;
}) {
  const columns = useMemo<TableColumnDef<HoursTableRow>[]>(() => {
    
    const renderActionsMenu = (row: HoursTableRow) => {
      if (!resourcesById.get(row.resourceId)?.writable || isEntryPending(row.id)) return null;
      return <ActionsMenu
        ariaLabel={`Actions for ${row.item.taskTitle ?? row.item.categoryLabel} on ${row.date}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => onEdit(row) },
          { id: 'delete', label: 'Delete', variant: 'danger', onClick: () => onDelete(row) },
        ]}
      />;
    };

    return [
      { id: 'firstName', header: 'First Name', accessorFn: row => row.staffFirstName },
    { id: 'lastName', header: 'Last Name', accessorFn: row => row.staffLastName },
    { id: 'date', header: 'Date', size: 140, accessorFn: row => formatShortDate(row.date) },
    { id: 'cycle', header: 'Cycle', accessorFn: row => row.item.cycleName ?? '—' },
    { id: 'program', header: 'Program', accessorFn: row => row.item.programName ?? '—' },
    { id: 'category', header: 'Category', accessorFn: row => row.item.categoryLabel },
    { id: 'hours', header: 'Hours', size: 100, accessorFn: row => row.item.hours },
    { id: 'note', header: 'Note', accessorFn: row => row.item.note },
    { id: 'type', header: 'Type', size: 110,
      accessorFn: row => HOURS_ENTRY_TYPE_LABELS[getHoursEntryType(row.item)],
      cell: ({ row }) => <HoursTypeLabel item={row.original.item} />,
    },
    ...(canWrite ? [{
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row }: { row: { original: HoursTableRow } }) => renderActionsMenu(row.original),
    }] : []),
    ];
  }, [canWrite, isEntryPending, onDelete, onEdit, resourcesById]);

  return { columns };
}
