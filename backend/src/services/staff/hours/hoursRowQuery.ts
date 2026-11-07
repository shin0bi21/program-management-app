import { sql } from '../../../db/client';
import { getHoursCategoryLabel } from './hoursReferenceData';
import type { HoursCategory } from '../../../validation/hoursSchemas';

export interface HoursRow {
  id: string;
  staffId: string;
  firstName: string;
  lastName: string;
  name: string;
  programId: string | null;
  program: string | null;
  cycleId: string;
  cycle: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: HoursCategory;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  date: string;
  hours: string;
  note: string;
  type: 'task' | 'session' | 'regular';
}

/** Canonical hours fields shared by collection and direct-record reads. */
export const hoursRowColumns = sql`
  entry.id,
  entry.staff_id,
  staff.first_name,
  staff.last_name,
  CONCAT(staff.first_name, ' ', staff.last_name) AS name,
  entry.program_id,
  program.name AS program,
  cycle.id AS cycle_id,
  cycle.name AS cycle,
  cycle.starts_on::text AS cycle_starts_on,
  cycle.ends_on::text AS cycle_ends_on,
  entry.category,
  entry.task_id,
  task.title AS task_title,
  entry.session_id,
  session.theme AS session_label,
  entry.date::text,
  entry.hours::text,
  entry.note,
  CASE
    WHEN entry.task_id IS NOT NULL THEN 'task'
    WHEN entry.session_id IS NOT NULL THEN 'session'
    ELSE 'regular'
  END AS type
`;

/** Canonical hours relationships shared by collection and direct-record reads. */
export const hoursRowFrom = sql`
  FROM time_entries entry
  INNER JOIN users staff ON staff.id = entry.staff_id
  LEFT JOIN programs program ON program.id = entry.program_id
  INNER JOIN program_cycles cycle ON cycle.id = entry.cycle_id
  LEFT JOIN tasks task ON task.id = entry.task_id
  LEFT JOIN program_sessions session ON session.id = entry.session_id
`;

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
 * Builds rows for table and calendar items.
 * @param appliedFilters - SQL filters supplied by the service.
 * @param query - Database client; pass trx inside a transaction.
 * @example getHoursRows(appliedFilters, trx)
 */
export function getHoursRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<HoursRow[]>`
    SELECT ${hoursRowColumns}
    ${hoursRowFrom}
    WHERE ${appliedFilters}
  `;
}

/**
 * Shapes an hours row for all entry views.
 * @param row - Loaded hours row.
 * @example toHoursItem(row) // complete entry with numeric hours
 */
export function toHoursItem(row: HoursRow) {
  return {
    ...row,
    categoryLabel: getHoursCategoryLabel(row.category),
    hours: Number(row.hours),
  };
}

/**
 * Loads one hours row.
 * @param id - Hours entry to load.
 * @param trx - Transaction for the read.
 * @example getHoursRow(id, trx)
 */
export async function getHoursRow(id: string, trx: typeof sql) {
  const [row] = await getHoursRows(trx`entry.id = ${id}`, trx);
  return row;
}
