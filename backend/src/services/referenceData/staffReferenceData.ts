import { sql } from '../../db/client';
import { ForbiddenError } from '../../errors';
import { sharedStaffResourceReadPredicate } from '../../policies/staffResourcePolicy';
import { taskWriteScopePredicate } from '../../policies/taskPolicy';
import { hoursWriteScopePredicate } from '../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../types/auth';
import type { StaffReferenceFeature } from '../../validation/referenceDataSchemas';

export function getStaffReferenceData(actor: AccessTokenPayload, feature: StaffReferenceFeature) {
  if (!actor.permissions.includes(feature === 'tasks' ? 'read:tasks' : 'read:hours')) {
    throw new ForbiddenError('Insufficient permissions');
  }

  const writable = feature === 'tasks'
    ? taskWriteScopePredicate(actor, sql`staff.id`)
    : hoursWriteScopePredicate(actor, sql`staff.id`);

  return sql<Array<{ id: string; firstName: string; lastName: string; name: string; role: string; writable: boolean }>>`
    SELECT staff.id, staff.first_name, staff.last_name,
      CONCAT(staff.first_name, ' ', staff.last_name) AS name, role.name AS role,
      (${writable}) AS writable
    FROM users staff
    INNER JOIN user_roles role ON role.id = staff.role_id
    INNER JOIN user_credentials credentials ON credentials.user_id = staff.id
    WHERE role.name IN ('admin', 'staff') AND credentials.status = 'active'
      AND ${sharedStaffResourceReadPredicate(actor, sql`staff.id`)}
    ORDER BY staff.first_name, staff.last_name, staff.id
  `;
}
