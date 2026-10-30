import { sql } from '../../db/client';
import { cycleRecordColumns, type CycleRow } from '../programming/cycles/cycleRecordQuery';

export function getCycleReferenceData() {
  return sql<CycleRow[]>`
    SELECT ${cycleRecordColumns} FROM program_cycles cycle
    ORDER BY cycle.starts_on DESC, cycle.name, cycle.id
  `;
}
