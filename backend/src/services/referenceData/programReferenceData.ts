import { sql } from '../../db/client';
import { ForbiddenError } from '../../errors';
import { programAccessPredicate } from '../../policies/programAccessPolicy';
import type { AccessTokenPayload, Permission } from '../../types/auth';

const programLabelPermissions: readonly Permission[] = [
  'read:programs', 'write:programs', 'read:sessions', 'read:tasks', 'read:hours',
  'read:youth_profiles', 'read:outreach', 'read:accounts', 'write:accounts',
];

export function getProgramReferenceData(user: AccessTokenPayload, assignedOnly = false) {
  if (!assignedOnly && !user.permissions.some(permission => programLabelPermissions.includes(permission))) {
    throw new ForbiddenError('Insufficient permissions');
  }

  return sql<Array<{ id: string; title: string }>>`
    SELECT program.id, program.title
    FROM programs program
    WHERE ${assignedOnly ? programAccessPredicate(user, sql`program.id`) : sql`TRUE`}
    ORDER BY program.title, program.id
  `;
}
