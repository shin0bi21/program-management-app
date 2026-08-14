import { sql } from '../../../db/client';
import type { TimeEntryCategory } from '../../../validation/timeEntrySchemas';

export interface TimeEntryRow {
  id: string;
  staffId: string;
  programId: string | null;
  programName: string | null;
  cycleId: string;
  cycleName: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: TimeEntryCategory;
  taskId: string | null;
  taskTitle: string | null;
  sessionId: string | null;
  sessionLabel: string | null;
  workDate: string;
  hours: string;
  note: string;
}

export const timeEntryCategoryLabels: Record<TimeEntryCategory, string> = {
  program_delivery: 'Program Delivery',
  planning_prep: 'Planning / Prep',
  meeting: 'Meeting',
  administration: 'Administration',
  outreach: 'Outreach',
  maintenance: 'Maintenance',
  other: 'Other',
};

/** Canonical time-entry fields shared by collection and direct-record reads. */
export const timeEntryRecordColumns = sql`
  entry.id,
  entry.staff_id,
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

/** Canonical time-entry relationships shared by collection and direct-record reads. */
export const timeEntryRecordFrom = sql`
  FROM time_entries entry
  INNER JOIN users staff ON staff.id = entry.staff_id
  LEFT JOIN programs program ON program.id = entry.program_id
  INNER JOIN program_cycles cycle ON cycle.id = entry.cycle_id
  LEFT JOIN tasks task ON task.id = entry.task_id
  LEFT JOIN cohort_sessions session ON session.id = entry.session_id
`;

/** Canonical time-entry response returned by insert and update commands. */
export const timeEntryMutationColumns = sql`
  id,
  staff_id,
  program_id,
  (SELECT name FROM programs WHERE id = time_entries.program_id) AS program_name,
  cycle_id,
  (SELECT name FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_name,
  (SELECT starts_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_starts_on,
  (SELECT ends_on::text FROM program_cycles WHERE id = time_entries.cycle_id) AS cycle_ends_on,
  category,
  task_id,
  (SELECT title FROM tasks WHERE id = time_entries.task_id) AS task_title,
  session_id,
  (SELECT session.theme FROM cohort_sessions session WHERE session.id = time_entries.session_id) AS session_label,
  work_date::text,
  hours::text,
  note
`;
