import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import StatusLabel from '../../../../../../common/components/StatusLabel/StatusLabel';
import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { ProgramSession } from '../../../types';
import { formatSessionTime } from '../../../utils/sessionSchedule';
import { formatShortDate } from '../../../../../../common/utils/date';
import SessionTypeLabel from '../../SessionTypeLabel/SessionTypeLabel';

/**
 * Builds session columns using saved dates and clock times, with permitted write actions.
 * @param options - Write capability and page-owned edit/delete callbacks.
 * @example useSessionTable({ canWriteSessions: false, onEdit, onDelete }) // columns without actions
 */
export default function useSessionTable({
  canWriteSessions,
  onEdit,
  onDelete,
}: {
  canWriteSessions: boolean;
  onEdit: (session: ProgramSession) => void;
  onDelete: (session: ProgramSession) => void;
}) {
  return useMemo<TableColumnDef<ProgramSession>[]>(() => [
    { id: 'program', header: 'Program', accessorFn: session => session.program },
    { id: 'cycle', header: 'Cycle', accessorFn: session => session.cycle },
    { id: 'title', header: 'Title', accessorFn: session => session.title },
    {
      id: 'date', header: 'Date', size: 135,
      accessorFn: session => formatShortDate(session.date),
    },
    {
      id: 'time',
      header: 'Time',
      size: 165,
      accessorFn: session => `${formatSessionTime(session.startTime)} – ${formatSessionTime(session.endTime)}`,
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
        ariaLabel={`More actions for ${session.title}`}
        items={[
          { id: 'edit', label: 'Edit', onClick: () => onEdit(session) },
          { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => onDelete(session) },
        ]}
      />,
    }] : []),
  ], [canWriteSessions, onDelete, onEdit]);
}
