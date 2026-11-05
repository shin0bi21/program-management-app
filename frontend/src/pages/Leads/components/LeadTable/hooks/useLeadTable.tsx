import { useMemo } from 'react';
import type { CellContext } from '@tanstack/react-table';

import Label from '../../../../../common/components/Label/Label';
import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../common/components/Table/Table.types';
import { formatShortDate } from '../../../../../common/utils/date';
import type { EditableLeadStatus, Lead, LeadOrigin } from '../../../types';

const statusTones = {
  new: 'attention',
  contacted: 'neutral',
  eligible: 'info',
  ineligible: 'negative',
  deferred: 'attention',
  closed: 'neutral',
  signed_up: 'positive',
} as const;

const editableStatuses: EditableLeadStatus[] = [
  'contacted',
  'eligible',
  'ineligible',
  'deferred',
  'closed',
];

interface UseLeadTableOptions {
  origin: LeadOrigin;
  canWrite: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onSignUp: (lead: Lead) => void;
  onStatusChange: (lead: Lead, status: EditableLeadStatus) => void | Promise<void>;
}

export default function useLeadTable({
  origin,
  canWrite,
  onEdit,
  onDelete,
  onSignUp,
  onStatusChange,
}: UseLeadTableOptions) {
  const columns = useMemo<TableColumnDef<Lead>[]>(() => [
    { id: 'firstName', header: 'First Name', accessorFn: lead => lead.youthFirstName },
    { id: 'lastName', header: 'Last Name', accessorFn: lead => lead.youthLastName },
    ...(origin === 'external' ? [{
      id: 'submittedByRole',
      header: 'Filled Out By',
      accessorFn: (lead: Lead) => title(lead.submittedByRole),
    }] : []),
    { id: 'school', header: 'School', accessorFn: lead => lead.school },
    { id: 'program', header: 'Eligible Program', accessorFn: lead => lead.recommendedProgramName ?? '—' },
    {
      id: 'status',
      header: 'Status',
      size: 120,
      accessorFn: lead => lead.status,
      cell: ({ row: { original: lead } }) => (
        <Label tone={statusTones[lead.status]}>{title(lead.status)}</Label>
      ),
    },
    { id: 'created', header: 'Created', size: 130, accessorFn: lead => formatShortDate(lead.createdAt) },
    ...(canWrite ? [{
      id: 'actions' as const,
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: lead } }: CellContext<Lead, unknown>) => (
        lead.status === 'signed_up' ? null : <ActionsMenu
          ariaLabel={`More actions for ${lead.youthFirstName} ${lead.youthLastName}`}
          items={[
            { id: 'edit', label: 'Edit', onClick: () => onEdit(lead) },
            { id: 'delete', label: 'Delete', variant: 'danger' as const, onClick: () => onDelete(lead) },
            { id: 'sign-up', label: 'Sign Up', groupStart: true, onClick: () => onSignUp(lead) },
            ...editableStatuses.filter(status => status !== lead.status).map((status, index) => ({
              id: status,
              label: `Mark ${title(status)}`,
              groupStart: index === 0,
              onClick: () => void onStatusChange(lead, status),
            })),
          ]}
        />
      ),
    }] : []),
  ], [canWrite, onDelete, onEdit, onSignUp, onStatusChange, origin]);

  return { columns };
}

function title(value: string) {
  return value.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ');
}
