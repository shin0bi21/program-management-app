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
}

export interface AccountFilters {
  search?: string;
  roles?: AccountRole[];
  statuses?: AccountStatus[];
}

export interface InviteAccountInput {
  firstName: string;
  lastName: string;
  email: string;
  role: 'staff' | 'admin';
}

export interface UpdateAccountInput extends InviteAccountInput {
  id: string;
}
