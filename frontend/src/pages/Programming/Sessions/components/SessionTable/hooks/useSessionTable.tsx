import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import StatusBadge from '../../../../../../common/components/StatusBadge/StatusBadge';
import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { CohortSession } from '../../../types';
import type { Program } from '../../../../../../common/features/programs/types';
import { sessionDateTime } from '../../../utils/sessionSchedule';
import { formatShortDate } from '../../../../../../common/utils/date';
import SessionTypeBadge from '../../SessionTypeBadge/SessionTypeBadge';

const noPrograms: Program[] = [];

export default function useSessionTable({
  programs = noPrograms,
  canWriteAttendance,
  canWriteSessions,
  onTakeAttendance,
  onEdit,
  onDelete,
}: {
  programs?: Program[];
  canWriteAttendance: boolean;
  canWriteSessions: boolean;
  onTakeAttendance: (session: CohortSession) => void;
  onEdit: (session: CohortSession) => void;
  onDelete: (session: CohortSession) => void;
}) {
  return useMemo<TableColumnDef<CohortSession>[]>(() => [
    { id: 'program', header: 'Program', accessorFn: session => session.programName },
    { id: 'cohort', header: 'Cycle', accessorFn: session => session.cohortName },
    { id: 'theme', header: 'Title / Theme', accessorFn: session => session.theme },
    {
      id: 'date', header: 'Date', size: 135,
      accessorFn: session => {
        const timezone = programs.find(program => program.id === session.programId)?.timezone ?? 'America/Toronto';
        return formatShortDate(sessionDateTime(session.startsAt, timezone).date);
      },
    },
    {
      id: 'time',
      header: 'Time',
      size: 165,
      accessorFn: session => {
        const timezone = programs.find(program => program.id === session.programId)?.timezone ?? 'America/Toronto';
        const timeFormatter = new Intl.DateTimeFormat('en-CA', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
        return `${timeFormatter.format(new Date(session.startsAt))} – ${timeFormatter.format(new Date(session.endsAt))}`;
      },
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
      cell: ({ row: { original: session } }) => <StatusBadge status={session.state} label={session.state.charAt(0).toUpperCase() + session.state.slice(1)} />,
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
  ], [programs, canWriteAttendance, canWriteSessions, onDelete, onEdit, onTakeAttendance]);
}
