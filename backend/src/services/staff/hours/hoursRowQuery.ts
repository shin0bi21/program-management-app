import { sql } from '../../../db/client';
import { hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import { HOURS_CATEGORY_OPTIONS } from './hoursReferenceData';

export interface Hours {
  id: string;
  staffId: string;
  programId: string | null;
  category:
    | 'program_delivery'
    | 'planning_prep'
    | 'meeting'
    | 'administration'
    | 'outreach'
    | 'maintenance'
    | 'other';
  date: string;
  hours: number;
  note: string;
  taskId: string | null;
  sessionId: string | null;

  firstName: string;
  lastName: string;

  program: string | null;

  cycleId: string;
  cycle: string;
  cycleStartsOn: string;
  cycleEndsOn: string;

  taskTitle: string | null;

  sessionTitle: string | null;

  categoryLabel: string;
  type: 'task' | 'session' | 'regular';
}

const categoryLabels = Object.fromEntries(HOURS_CATEGORY_OPTIONS.map(option => [option.id, option.name]));

/** Searchable hours values shared by calendar and table collection reads. */
export const hoursSearchValue = sql`CONCAT_WS(' ',
  staff.first_name,
  staff.last_name,
  program.title,
  cycle.title,
  entry.category::text,
  task.title,
  session.title,
  entry.note,
  entry.date
)`;

/**
 * Builds canonical hours rows within the user's readable staff scope.
 * @param user - User whose staff scope is always enforced.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @returns Complete rows with category labels and numeric hours; storage allows more than 0 and at most 24 hours with two decimal places.
 * @example getHoursRows(user, appliedFilters, trx)
 */
export function getHoursRows(user: AccessTokenPayload, appliedFilters = sql`TRUE`, query = sql) {
  // 1. Build complete hours rows within the user’s staff scope.
  return query<Hours[]>`
    SELECT
      entry.id,
      entry.staff_id,
      entry.program_id,
      entry.category,
      entry.date,
      entry.hours::double precision,
      entry.note,
      entry.task_id,
      entry.session_id,

      staff.first_name,
      staff.last_name,

      program.title AS program,

      cycle.id AS cycle_id,
      cycle.title AS cycle,
      cycle.starts_on AS cycle_starts_on,
      cycle.ends_on AS cycle_ends_on,

      task.title AS task_title,

      session.title AS session_title,

      ${query.json(categoryLabels)}::jsonb ->> entry.category AS category_label,
      CASE
        WHEN entry.task_id IS NOT NULL THEN 'task'
        WHEN entry.session_id IS NOT NULL THEN 'session'
        ELSE 'regular'
      END AS type
    FROM time_entries entry
    INNER JOIN users staff ON staff.id = entry.staff_id
    LEFT JOIN programs program ON program.id = entry.program_id
    INNER JOIN program_cycles cycle ON cycle.id = entry.cycle_id
    LEFT JOIN tasks task ON task.id = entry.task_id
    LEFT JOIN program_sessions session ON session.id = entry.session_id
    WHERE ${hoursReadScopePredicate(user, query`entry.staff_id`)}
      AND (${appliedFilters})
  `;
}
