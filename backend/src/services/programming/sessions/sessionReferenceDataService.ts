import type { AccessTokenPayload } from '../../../types/auth';
import { getPrograms } from '../../programService';
import { getSessionTypes } from './sessionService';

/**
 * Supplies programs the actor can access and session types for session controls.
 * @param actor - Actor whose program assignments and role scope the program choices.
 * @example getSessionReferenceData(staffActor) // assigned programs and all session types
 */
export async function getSessionReferenceData(actor: AccessTokenPayload) {
  // 1. Load scoped programs and session types in parallel.
  const assignedOnly = true;
  const [programs, sessionTypes] = await Promise.all([
    getPrograms(actor, assignedOnly),
    getSessionTypes(),
  ]);

  return { programs, sessionTypes };
}
