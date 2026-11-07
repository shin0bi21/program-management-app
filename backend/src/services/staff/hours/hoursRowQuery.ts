import { sql } from '../../../db/client';
import { getHoursCategoryLabel } from './hoursReferenceData';
import type { HoursCategory } from '../../../validation/hoursSchemas';

export interface HoursRow {
  id: string;
  staffId: string;
  staffFirstName: string;
  staffLastName: string;
  staffName: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: HoursCategory;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  workDate: string;
  hours: string;
  note: string;
}

/** Canonical hours fields shared by collection and direct-record reads. */
export const hoursRowColumns = sql`
  entry.id,
  entry.staff_id,
  staff.first_name AS staff_first_name,
  staff.last_name AS staff_last_name,
  CONCAT(staff.first_name, ' ', staff.last_name) AS staff_name,
  entry.program_id,
  program.name AS program_name,
  cycle.id AS cycle_id,
  cycle.name AS cycle_name,
  cycle.starts_on::text AS cycle_starts_on,
  cycle.ends_on::text AS cycle_ends_on,
  entry.category,
  entry.task_id,
  task.title AS task_title,
  entry.session_id,
  session.theme AS session_label,
  entry.work_date::text,
  entry.hours::text,
  entry.note
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
  entry.work_date::text
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
 * Shapes an hours row for the existing entry response.
 * @param row - Loaded hours row.
 * @example hoursRowToEntry(row) // numeric hours
 */
export function hoursRowToEntry(row: HoursRow) {
  return {
    id: row.id, staffId: row.staffId, workDate: row.workDate,
    programId: row.programId, programName: row.programName,
    cycleId: row.cycleId, cycleName: row.cycleName,
    cycleStartsOn: row.cycleStartsOn, cycleEndsOn: row.cycleEndsOn,
    category: row.category, categoryLabel: getHoursCategoryLabel(row.category),
    taskId: row.taskId, taskTitle: row.taskTitle,
    sessionId: row.sessionId, sessionLabel: row.sessionLabel,
    hours: Number(row.hours), note: row.note,
  };
}

/**
 * Shapes an hours row for the existing table response.
 * @param row - Loaded hours row.
 * @example hoursRowToTableRow(row) // staff details and item
 */
export function hoursRowToTableRow(row: HoursRow) {
  const { staffId, workDate, ...item } = hoursRowToEntry(row);
  return {
    id: row.id,
    resourceId: staffId,
    date: workDate,
    staffFirstName: row.staffFirstName,
    staffLastName: row.staffLastName,
    staffName: row.staffName,
    item,
  };
}

export type HoursTableRow = ReturnType<typeof hoursRowToTableRow>;

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
