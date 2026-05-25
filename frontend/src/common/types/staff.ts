export interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'staff' | 'admin';
  status: 'invited' | 'active' | 'inactive';
  createdAt: string;
}

export interface InviteStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  role?: 'staff' | 'admin';
}

export interface UpdateStaffInput {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role?: 'staff' | 'admin';
}
