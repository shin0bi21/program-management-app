import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import { formatShortDate } from '../../../../../common/utils/date';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { YouthProfile } from '../../../types';

interface UseYouthTableOptions {
  canWrite: boolean;
  onEdit: (profile: YouthProfile) => void;
  onAddNote: (youthId: string) => void;
}

/**
 * Supplies Youth table columns and the actions available to the current viewer.
 * @param options.canWrite - Whether to include the Edit Profile and Add Note actions.
 * @param options.onEdit - Receives the profile whose Edit Profile action was selected.
 * @param options.onAddNote - Receives the youth ID whose Add Note action was selected.
 * @example useYouthTable({ canWrite: false, onEdit, onAddNote }) // read-only columns
 */
export default function useYouthTable({ canWrite, onEdit, onAddNote }: UseYouthTableOptions) {
  const columns = useMemo<TableColumnDef<YouthProfile>[]>(() => [
    { id: 'firstName', header: 'First Name', accessorFn: profile => profile.firstName },
    { id: 'lastName', header: 'Last Name', accessorFn: profile => profile.lastName },
    { id: 'dateOfBirth', header: 'Date of Birth', accessorFn: profile => profile.dateOfBirth ? formatShortDate(profile.dateOfBirth) : '—', size: 150 },
    { id: 'school', header: 'School', accessorFn: profile => profile.schoolName ?? '—' },
    {
      id: 'activeProgram',
      header: 'Active Program',
      accessorFn: profile => profile.activeProgram?.program ?? '—',
    },
    ...(canWrite ? [{
      id: 'actions' as const,
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: profile } }: CellContext<YouthProfile, unknown>) => <ActionsMenu
        ariaLabel={`More actions for ${profile.firstName} ${profile.lastName}`}
        items={[
          { id: 'edit', label: 'Edit Profile', onClick: () => onEdit(profile) },
          { id: 'add-note', label: 'Add Note', onClick: () => onAddNote(profile.id) },
        ]}
      />,
    }] : []),
  ], [canWrite, onAddNote, onEdit]);

  return { columns };
}
