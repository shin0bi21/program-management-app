import { sql } from '../../db/client';
import { ForbiddenError } from '../../errors';
import { sharedStaffReadPredicate } from '../../policies/staffPolicy';
import { taskWriteScopePredicate } from '../../policies/taskPolicy';
import { hoursWriteScopePredicate } from '../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { StaffReferenceFeature } from '../../validation/referenceDataSchemas';

/**
 * Lists active staff visible to the actor with feature-specific write access.
 * @param actor - Signed-in user who must have the feature's read permission.
 * @param feature - Tasks or Hours policy used to determine writability.
 * @example getStaffReferenceData(actor, 'hours') // readable staff with Hours capabilities
 */
export function getStaffReferenceData(actor: AccessTokenPayload, feature: StaffReferenceFeature) {
  // 1. Require read access and derive write access for the requested feature.
  if (!actor.permissions.includes(feature === 'tasks' ? 'read:tasks' : 'read:hours')) {
    throw new ForbiddenError('Insufficient permissions');
  }

  const writable = feature === 'tasks'
    ? taskWriteScopePredicate(actor, sql`staff.id`)
    : hoursWriteScopePredicate(actor, sql`staff.id`);

  // 2. Load active staff within the shared visibility policy.
  return sql<Array<{ id: string; firstName: string; lastName: string; role: string; name: string; writable: boolean }>>`
    SELECT
      staff.id,
      staff.first_name,
      staff.last_name,

      role.name AS role,

      CONCAT(staff.first_name, ' ', staff.last_name) AS name,
      (${writable}) AS writable
    FROM users staff
    INNER JOIN user_roles role ON role.id = staff.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = staff.id
    WHERE role.name IN ('admin', 'project_manager', 'staff') AND credentials.status = 'active'
      AND ${sharedStaffReadPredicate(actor, sql`staff.id`)}
    ORDER BY staff.first_name, staff.last_name, staff.id
  `;
}
