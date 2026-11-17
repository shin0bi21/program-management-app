import type { AccessTokenPayload } from '../../../types/auth';
import { getPrograms } from '../../programService';
import { getSessionTypes } from './sessionService';

/**
 * Supplies programs the user can access and session types for session controls.
 * @param user - User whose program assignments and role scope the program choices.
 * @example getSessionReferenceData(staffUser) // assigned programs and all session types
 */
export async function getSessionReferenceData(user: AccessTokenPayload) {
  // 1. Load scoped programs and session types in parallel.
  const assignedOnly = true;
  const [programs, sessionTypes] = await Promise.all([
    getPrograms(user, assignedOnly),
    getSessionTypes(),
  ]);

  return { programs, sessionTypes };
}
