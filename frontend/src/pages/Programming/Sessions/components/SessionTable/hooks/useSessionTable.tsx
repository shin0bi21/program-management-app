import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import StatusLabel from '../../../../../../common/components/StatusLabel/StatusLabel';
import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramSession } from '../../../types';
import type { Program } from '../../../../../../common/features/programs/types';
import { sessionDateTime } from '../../../utils/sessionSchedule';
import { formatShortDate } from '../../../../../../common/utils/date';
import SessionTypeLabel from '../../SessionTypeLabel/SessionTypeLabel';

const noPrograms: Program[] = [];

export default function useSessionTable({
  programs = noPrograms,
  canWriteSessions,
  onEdit,
  onDelete,
}: {
  programs?: Program[];
  canWriteSessions: boolean;
  onEdit: (session: ProgramSession) => void;
  onDelete: (session: ProgramSession) => void;
}) {
  return useMemo<TableColumnDef<ProgramSession>[]>(() => [
    { id: 'program', header: 'Program', accessorFn: session => session.programName },
    { id: 'cycle', header: 'Cycle', accessorFn: session => session.cycleName },
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
      accessorFn: session => session.sessionType,
      cell: ({ row: { original: session } }) => <SessionTypeLabel name={session.sessionType} />,
    },
    {
      id: 'status',
      header: 'Status',
      size: 110,
      accessorFn: session => session.state,
      cell: ({ row: { original: session } }) => <StatusLabel status={session.state} label={session.state.charAt(0).toUpperCase() + session.state.slice(1)} />,
    },
    ...(canWriteSessions ? [{
      id: 'actions',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: session } }: CellContext<ProgramSession, unknown>) => <ActionsMenu
        ariaLabel={`More actions for ${session.theme}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => onEdit(session) },
          { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => onDelete(session) },
        ]}
      />,
    }] : []),
  ], [programs, canWriteSessions, onDelete, onEdit]);
}
