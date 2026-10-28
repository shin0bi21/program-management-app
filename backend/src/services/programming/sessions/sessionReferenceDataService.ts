import type { AccessTokenPayload } from '../../../types/auth';
import { getPrograms } from '../../programService';
import { getSessionTypes } from './sessionService';

export async function getSessionReferenceData(actor: AccessTokenPayload) {
  const [programs, sessionTypes] = await Promise.all([getPrograms(actor, true), getSessionTypes()]);
  return { programs, sessionTypes };
}
