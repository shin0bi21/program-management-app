export type UserRole = 'admin' | 'project_manager' | 'staff' | 'youth';
export type UserStatus = 'invited' | 'active' | 'inactive';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  programIds: string[];
}

export interface UserFilters {
  search?: string;
  roles?: UserRole[];
  statuses?: UserStatus[];
}

export const USER_TABLE_KEYS = ['name', 'email', 'role', 'status', 'createdAt'] as const;
export type UserSortKey = typeof USER_TABLE_KEYS[number];
