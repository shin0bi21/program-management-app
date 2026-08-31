import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { Program } from '../../../../../../common/features/programs/types';

export default function useProgramTable(onEdit: (program: Program) => void) {
  const columns = useMemo<TableColumnDef<Program>[]>(() => [
    { id: 'name', header: 'Program', accessorFn: program => program.name },
    {
      id: 'attendance',
      header: 'Attendance',
      accessorFn: program => program.rosterMode === 'open' ? 'Open attendance' : 'Enrollment required',
    },
    {
      id: 'ages',
      header: 'Ages',
      size: 120,
      accessorFn: program => program.minAge === null ? 'All ages' : `${program.minAge}–${program.maxAge}`,
    },
    {
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row: { original: program } }) => <ActionsMenu
        ariaLabel={`Actions for ${program.name}`}
        items={[{ id: 'edit', label: 'Edit Program', onClick: () => onEdit(program) }]}
      />,
    },
  ], [onEdit]);

  return { columns };
}
