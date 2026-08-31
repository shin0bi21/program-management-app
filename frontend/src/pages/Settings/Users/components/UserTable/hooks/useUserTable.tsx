import { useMemo } from 'react';

import ActionsMenu from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { TableColumnDef } from '../../../../../../common/components/Table/Table.types';
import type { Account, AccountStatus } from '../../../../../../common/types/account';
import { formatShortDate } from '../../../../../../common/utils/date';

interface UseUserTableOptions {
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (account: Account) => void;
  onRevoke: (account: Account) => void;
  onToggleStatus: (account: Account) => void;
}

export default function useUserTable({
  canWrite,
  isAdmin,
  onEdit,
  onRevoke,
  onToggleStatus,
}: UseUserTableOptions) {
  const columns = useMemo<TableColumnDef<Account>[]>(() => {
    const accountColumns: TableColumnDef<Account>[] = [
      {
        id: 'name',
        header: 'Name',
        accessorFn: account => `${account.firstName} ${account.lastName}`,
      },
      { id: 'email', header: 'Email', accessorFn: account => account.email },
      { id: 'role', header: 'Role', size: 110, accessorFn: account => titleCase(account.role) },
      {
        id: 'status',
        header: 'Status',
        size: 120,
        accessorFn: account => account.status,
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: 'createdAt',
        header: 'Created',
        size: 150,
        accessorFn: account => formatShortDate(account.createdAt),
      },
    ];

    if (!canWrite) return accountColumns;

    return [...accountColumns, {
      id: 'actions',
      size: 40,
      enableResizing: false,
      enableHiding: false,
      header: '',
      cell: ({ row: { original: account } }) => <ActionsMenu
        ariaLabel={`More actions for ${account.firstName} ${account.lastName}`}
        items={[
          ...(isAdmin && account.role !== 'youth'
            ? [{ id: 'edit', label: 'Edit', onClick: () => onEdit(account) }]
            : []),
          ...(account.status === 'invited'
            ? [{ id: 'revoke', label: 'Revoke Invite', variant: 'danger' as const, onClick: () => onRevoke(account) }]
            : []),
          ...(account.status === 'active'
            ? [{ id: 'deactivate', label: 'Deactivate', variant: 'danger' as const, onClick: () => onToggleStatus(account) }]
            : []),
          ...(account.status === 'inactive'
            ? [{ id: 'activate', label: 'Activate', onClick: () => onToggleStatus(account) }]
            : []),
        ]}
      />,
    }];
  }, [canWrite, isAdmin, onEdit, onRevoke, onToggleStatus]);

  return { columns };
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadge(status: AccountStatus) {
  return <span className={`status-badge status-${status}`}>{titleCase(status)}</span>;
}
