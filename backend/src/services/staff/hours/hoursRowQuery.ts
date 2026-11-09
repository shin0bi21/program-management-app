import { sql } from '../../../db/client';
import { hoursReadScopePredicate } from '../../../policies/hoursPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import { HOURS_CATEGORY_OPTIONS } from './hoursReferenceData';
import type { HoursCategory } from '../../../validation/hoursSchemas';

export interface HoursRow {
  id: string;
  staffId: string;
  programId: string | null;
  category: HoursCategory;
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

  sessionLabel: string | null;

  name: string;
  categoryLabel: string;
  type: 'task' | 'session' | 'regular';
}

const categoryLabels = Object.fromEntries(HOURS_CATEGORY_OPTIONS.map(option => [option.value, option.label]));

/** Searchable hours values shared by calendar and table collection reads. */
export const hoursSearchValue = sql`CONCAT_WS(' ',
  staff.first_name,
  staff.last_name,
  program.name,
  cycle.name,
  entry.category::text,
  task.title,
  session.theme,
  entry.note,
  entry.date::text
)`;

/**
 * Builds canonical hours rows within the actor's readable staff scope.
 * @param actor - Actor whose resource scope is always enforced.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @returns Complete rows with category labels and numeric hours; storage allows more than 0 and at most 24 hours with two decimal places.
 * @example getHoursRows(actor, appliedFilters, trx)
 */
export function getHoursRows(actor: AccessTokenPayload, appliedFilters = sql`TRUE`, query = sql) {
  // 1. Build complete hours rows within the actor’s staff scope.
  return query<HoursRow[]>`
    SELECT
      entry.id,
      entry.staff_id,
      entry.program_id,
      entry.category,
      entry.date::text,
      entry.hours::double precision,
      entry.note,
      entry.task_id,
      entry.session_id,

      staff.first_name,
      staff.last_name,

      program.name AS program,

      cycle.id AS cycle_id,
      cycle.name AS cycle,
      cycle.starts_on::text AS cycle_starts_on,
      cycle.ends_on::text AS cycle_ends_on,

      task.title AS task_title,

      session.theme AS session_label,

      CONCAT(staff.first_name, ' ', staff.last_name) AS name,
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
    WHERE ${hoursReadScopePredicate(actor, query`entry.staff_id`)}
      AND (${appliedFilters})
  `;
}
