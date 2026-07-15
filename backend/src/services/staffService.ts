import type { SetStaffInput } from '../validation/staffSchemas';
import {
  getStaffAccounts,
  revokeStaffAccountInvite,
  setStaffAccount,
  toggleStaffAccountStatus,
} from './accountService';

// Staff-specific application boundary. Credential and invitation lifecycle
// belongs to accountService; staff routes retain their existing API contract
// and staff permissions while the accounts API is introduced incrementally.
export function getStaff() {
  return getStaffAccounts();
}

export function setStaff(data: SetStaffInput, actorId: string) {
  return setStaffAccount(data, actorId);
}

export function deleteStaff(userId: string, actorId: string) {
  return revokeStaffAccountInvite(userId, actorId);
}

export function toggleStaffStatus(userId: string, actorId: string) {
  return toggleStaffAccountStatus(userId, actorId);
}
