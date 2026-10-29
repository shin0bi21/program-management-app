import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import { formatShortDate } from '../../../../../common/utils/date';
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
    { id: 'dateOfBirth', header: 'Date of Birth', accessorFn: profile => formatBirthDate(profile.dateOfBirth), size: 150 },
    { id: 'school', header: 'School', accessorFn: profile => profile.schoolName ?? '—' },
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

function formatBirthDate(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—';

  // DOB is a calendar date, even when the API serializes it as a UTC timestamp.
  const calendarDate = dateOfBirth.split('T')[0];
  return formatShortDate(new Date(`${calendarDate}T12:00:00`));
}
