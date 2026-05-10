export interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface InviteStaffInput {
  firstName: string;
  lastName: string;
  email: string;
  role?: string;
}
