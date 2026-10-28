import { sql } from '../../db/client';
import { ForbiddenError } from '../../errors';
import { programAccessPredicate } from '../../policies/programAccessPolicy';
import type { AccessTokenPayload, Permission } from '../../types/auth';

const programLabelPermissions: readonly Permission[] = [
  'read:programs', 'write:programs', 'read:sessions', 'read:tasks', 'read:hours',
  'read:youth_profiles', 'read:outreach', 'read:accounts', 'write:accounts',
];

export function getProgramReferenceData(actor: AccessTokenPayload, assignedOnly = false) {
  if (!assignedOnly && !actor.permissions.some(permission => programLabelPermissions.includes(permission))) {
    throw new ForbiddenError('Insufficient permissions');
  }

  return sql<Array<{ id: string; name: string }>>`
    SELECT program.id, program.name
    FROM programs program
    WHERE ${assignedOnly ? programAccessPredicate(actor, sql`program.id`) : sql`TRUE`}
    ORDER BY program.name, program.id
  `;
}
