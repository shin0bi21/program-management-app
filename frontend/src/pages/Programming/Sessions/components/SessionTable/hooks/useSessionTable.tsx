import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { CohortSession } from '../../../types';
import { formatShortDate } from '../../../../../../common/utils/date';
import SessionTypeBadge from '../../SessionTypeBadge/SessionTypeBadge';

const timeFormatter = new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit',
});

export default function useSessionTable({
  canWriteAttendance,
  canWriteSessions,
  onTakeAttendance,
  onEdit,
  onDelete,
}: {
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onTakeAttendance: (session: CohortSession) => void;
  onEdit: (session: CohortSession) => void;
  onDelete: (session: CohortSession) => void;
}) {
  return useMemo<TableColumnDef<CohortSession>[]>(() => [
    { id: 'program', header: 'Program', accessorFn: session => session.programName },
    { id: 'cohort', header: 'Cohort', accessorFn: session => session.cohortName },
    { id: 'theme', header: 'Title / Theme', accessorFn: session => session.theme },
    { id: 'date', header: 'Date', size: 135, accessorFn: session => formatShortDate(session.startsAt) },
    {
      id: 'time',
      header: 'Time',
      size: 165,
      accessorFn: session => `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`,
    },
    {
      id: 'type',
      header: 'Type',
      size: 135,
      accessorFn: session => session.sessionTypeName,
      cell: ({ row: { original: session } }) => <SessionTypeBadge name={session.sessionTypeName} />,
    },
    {
      id: 'status',
      header: 'Status',
      size: 110,
      accessorFn: session => session.state,
      cell: ({ row: { original: session } }) => <span className={`session-state session-state--${session.state}`}>{session.state}</span>,
    },
    ...(canWriteAttendance || canWriteSessions ? [{
      id: 'actions',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: session } }: CellContext<CohortSession, unknown>) => <ActionsMenu
        ariaLabel={`More actions for ${session.theme}`}
        items={[
          ...(canWriteAttendance ? [{ id: 'attendance', label: 'Take Attendance', onClick: () => onTakeAttendance(session) }] : []),
          ...(canWriteSessions ? [
            { id: 'edit', label: 'Edit Session', onClick: () => onEdit(session) },
            { id: 'delete', label: 'Delete Session', variant: 'danger' as const, onClick: () => onDelete(session) },
          ] : []),
        ]}
      />,
    }] : []),
  ], [canWriteAttendance, canWriteSessions, onDelete, onEdit, onTakeAttendance]);
}
