import { sql } from '../../db/client';
import { cycleRowColumns, type CycleRow } from '../programming/cycles/cycleRowQuery';

/**
 * Lists cycle choices, newest first.
 * @example getCycleReferenceData() // cycle rows
 */
export function getCycleReferenceData() {
  return sql<CycleRow[]>`
    SELECT ${cycleRowColumns}
    FROM program_cycles cycle
    ORDER BY cycle.starts_on DESC, cycle.name, cycle.id
  `;
}
