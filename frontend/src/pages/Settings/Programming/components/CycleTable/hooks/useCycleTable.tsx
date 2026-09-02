import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramCycle } from '../../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../../common/utils/date';

interface UseCycleTableOptions {
  onEdit: (cycle: ProgramCycle) => void;
  onDelete: (cycle: ProgramCycle) => void;
}

export default function useCycleTable({ onEdit, onDelete }: UseCycleTableOptions) {
  const columns = useMemo<TableColumnDef<ProgramCycle>[]>(() => [
    { id: 'name', header: 'Cycle', accessorFn: cycle => cycle.name },
    { id: 'start', header: 'Start', size: 140, accessorFn: cycle => formatShortDate(cycle.startsOn) },
    { id: 'end', header: 'End', size: 140, accessorFn: cycle => formatShortDate(cycle.endsOn) },
    {
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row: { original: cycle } }) => <ActionsMenu
        ariaLabel={`Actions for ${cycle.name}`}
        items={[
          { id: 'edit', label: 'Edit Cycle', onClick: () => onEdit(cycle) },
          { id: 'delete', label: 'Delete Cycle', variant: 'danger', onClick: () => onDelete(cycle) },
        ]}
      />,
    },
  ], [onDelete, onEdit]);

  return { columns };
}
