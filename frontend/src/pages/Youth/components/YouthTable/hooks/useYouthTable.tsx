import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import type { YouthProfile } from '../../../types';

interface UseYouthTableOptions {
  canWrite: boolean;
  onEdit: (profile: YouthProfile) => void;
  onAddNote: (profile: YouthProfile) => void;
}

export default function useYouthTable({ canWrite, onEdit, onAddNote }: UseYouthTableOptions) {
  const columns = useMemo<TableColumnDef<YouthProfile>[]>(() => [
    { id: 'firstName', header: 'First Name', accessorFn: profile => profile.firstName },
    { id: 'lastName', header: 'Last Name', accessorFn: profile => profile.lastName },
    { id: 'age', header: 'Age', accessorFn: profile => profile.age ?? '—', size: 100 },
    { id: 'school', header: 'School', accessorFn: profile => profile.schoolName ?? '—' },
    { id: 'grade', header: 'Grade', accessorFn: profile => profile.gradeLevel ?? '—', size: 100 },
    {
      id: 'program',
      header: 'Program',
      accessorFn: profile => {
        const names = [...new Set(
          profile.cohorts
            .filter(cohort => cohort.withdrawnOn === null)
            .map(cohort => cohort.programName),
        )];
        return names.length ? names.join(', ') : '—';
      },
    },
    {
      id: 'status',
      header: 'Status',
      size: 110,
      accessorFn: profile => profile.status,
      cell: ({ row: { original: profile } }: CellContext<YouthProfile, unknown>) => (
        <span className={`status-badge status-${profile.status}`}>
          {profile.status === 'active' ? 'Active' : 'Inactive'}
        </span>
      ),
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
          { id: 'add-note', label: 'Add Note', onClick: () => onAddNote(profile) },
        ]}
      />,
    }] : []),
  ], [canWrite, onAddNote, onEdit]);

  return { columns };
}
