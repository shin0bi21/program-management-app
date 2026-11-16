import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import { formatShortDate } from '../../../../../../common/utils/date';

interface UseCycleTableOptions {
  onEdit: (cycle: ProgramCycle) => void;
  onDelete: (cycle: ProgramCycle) => void;
}

/**
 * Builds cycle columns and delegates edit/delete actions with the selected saved cycle.
 * @param options - Callbacks for the table's permitted cycle management actions.
 * @example useCycleTable({ onEdit, onDelete }).columns
 */
export default function useCycleTable({ onEdit, onDelete }: UseCycleTableOptions) {
  const columns = useMemo<TableColumnDef<ProgramCycle>[]>(() => [
    { id: 'title', header: 'Cycle', accessorFn: cycle => cycle.title },
    { id: 'start', header: 'Start', size: 140, accessorFn: cycle => formatShortDate(cycle.startsOn) },
    { id: 'end', header: 'End', size: 140, accessorFn: cycle => formatShortDate(cycle.endsOn) },
    {
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row: { original: cycle } }) => <ActionsMenu
        ariaLabel={`Actions for ${cycle.title}`}
        items={[
          { id: 'edit', label: 'Edit Cycle', onClick: () => onEdit(cycle) },
          { id: 'delete', label: 'Delete Cycle', variant: 'danger', onClick: () => onDelete(cycle) },
        ]}
      />,
    },
  ], [onDelete, onEdit]);

  return { columns };
}
