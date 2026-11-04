import { useMemo } from 'react';

import StatusLabel from '../../../../../../common/components/StatusLabel/StatusLabel';
import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramCycleAssignment } from '../../../types';
import type { Program } from '../../../../../../common/features/programs/types';

interface ProgramCycleStatus {
  assignments: readonly Pick<ProgramCycleAssignment, 'programId' | 'state'>[];
  loading: boolean;
  error: string | null;
}

export default function useProgramTable(
  onEdit: (program: Program) => void,
  onManageCycles: (program: Program) => void,
  canWrite: boolean,
  { assignments, loading, error }: ProgramCycleStatus,
) {
  const statusColumn = useMemo<TableColumnDef<Program>>(() => {
    const activeProgramIds = new Set(assignments.filter(programCycle => programCycle.state === 'active').map(programCycle => programCycle.programId));
    const getStatus = (program: Program) => {
      if (error) return 'Unavailable';
      if (loading) return 'Loading…';

      return activeProgramIds.has(program.id) ? 'Active' : 'Inactive';
    };

    return {
      id: 'status',
      header: 'Status',
      size: 120,
      accessorFn: getStatus,
      // Assignment updates do not change program rows, so bypass the row's cached accessor value.
      cell: ({ row }) => {
        const label = getStatus(row.original);
        if (label === 'Unavailable' || label === 'Loading…') return label;

        return <StatusLabel status={label === 'Active' ? 'active' : 'inactive'} label={label} />;
      },
    };
  }, [assignments, loading, error]);

  const programColumns = useMemo<TableColumnDef<Program>[]>(() => [
    { id: 'name', header: 'Program', accessorFn: program => program.name },
    {
      id: 'enrollmentRequired',
      header: 'Enrollment Required',
      accessorFn: program => program.enrollmentRequired ? 'Yes' : 'No',
    },
    {
      id: 'ages',
      header: 'Ages',
      size: 120,
      accessorFn: program => program.minAge === null ? 'All ages' : `${program.minAge}–${program.maxAge}`,
    },
    ...(canWrite ? [{
      id: 'actions',
      header: '',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      cell: ({ row: { original: program } }) => <ActionsMenu
        ariaLabel={`Actions for ${program.name}`}
        items={[
          { id: 'edit', label: 'Edit Program', onClick: () => onEdit(program) },
          { id: 'cycles', label: 'Assigned Cycles', onClick: () => onManageCycles(program) },
        ]}
      />,
    } satisfies TableColumnDef<Program>] : []),
  ], [onEdit, onManageCycles, canWrite]);

  const columns = useMemo(() => [...programColumns.filter(column => column.id !== 'actions'), statusColumn, ...programColumns.filter(column => column.id === 'actions')], [programColumns, statusColumn]);

  return { columns };
}
