import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramCohort } from '../../../../../../common/types/cohort';
import { formatShortDate } from '../../../../../../common/utils/date';

export default function useCohortTable({
  canWrite,
  onManageRoster,
  onGenerateSessions,
  onEdit,
  onDelete,
}: {
  canWrite: boolean;
  onManageRoster: (cohort: ProgramCohort) => void;
  onGenerateSessions: (cohort: ProgramCohort) => void;
  onEdit: (cohort: ProgramCohort) => void;
  onDelete: (cohort: ProgramCohort) => void;
}) {
  return useMemo<TableColumnDef<ProgramCohort>[]>(() => [
    { id: 'program', header: 'Program', accessorFn: cohort => cohort.programName },
    { id: 'cohort', header: 'Cycle', accessorFn: cohort => cohort.cycleName },
    { id: 'start', header: 'Start', size: 140, accessorFn: cohort => formatShortDate(cohort.startsOn) },
    { id: 'end', header: 'End', size: 140, accessorFn: cohort => formatShortDate(cohort.endsOn) },
    {
      id: 'status',
      header: 'Status',
      size: 120,
      accessorFn: cohort => cohort.state,
      cell: ({ row: { original: cohort } }) => (
        <span className={`cohort-state cohort-state--${cohort.state}`}>{cohort.state}</span>
      ),
    },
    ...(canWrite ? [{
      id: 'actions',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: cohort } }: CellContext<ProgramCohort, unknown>) => <ActionsMenu
        ariaLabel={`More actions for ${cohort.name}`}
        items={[
          ...(cohort.rosterMode === 'enrolled'
            ? [{ id: 'manage-roster', label: 'Manage Roster', onClick: () => onManageRoster(cohort) }]
            : []),
          { id: 'add-sessions', label: 'Add Sessions', onClick: () => onGenerateSessions(cohort) },
          { id: 'edit', label: 'Edit Cohort', onClick: () => onEdit(cohort) },
          { id: 'delete', label: 'Delete Cohort', variant: 'danger' as const, onClick: () => onDelete(cohort) },
        ]}
      />,
    }] : []),
  ], [canWrite, onDelete, onEdit, onGenerateSessions, onManageRoster]);
}
