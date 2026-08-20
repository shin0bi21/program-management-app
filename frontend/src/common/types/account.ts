export type AccountRole = 'admin' | 'staff' | 'youth';
export type AccountStatus = 'invited' | 'active' | 'inactive';

export interface Account {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AccountRole;
  status: AccountStatus;
  createdAt: string;
  programIds?: string[];
}

export interface AccountFilters {
  search?: string;
  roles?: AccountRole[];
  statuses?: AccountStatus[];
}
export const ACCOUNT_TABLE_KEYS = ['name', 'email', 'role', 'status', 'createdAt'] as const;
export type AccountSortKey = typeof ACCOUNT_TABLE_KEYS[number];

export interface InviteAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'staff' | 'admin';
  programIds?: string[];
}

export interface UpdateAccountInput extends InviteAccountInput {
  id: string;
}
