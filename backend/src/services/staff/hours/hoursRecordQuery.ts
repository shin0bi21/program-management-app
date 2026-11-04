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
export const hoursRecordColumns = sql`
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
export const hoursRecordFrom = sql`
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

export async function getHoursRecord(id: string, trx: typeof sql) {
  const [row] = await trx<HoursRow[]>`
    SELECT ${hoursRecordColumns}
    ${hoursRecordFrom}
    WHERE entry.id = ${id}
  `;
  return row;
}
