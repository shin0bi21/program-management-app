import { sql } from '../../../db/client';
import { programAccessPredicate } from '../../../policies/programAccessPolicy';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramCycleQuery } from '../../../validation/programmingSchemas';
import { programCycleRecordColumns, programCycleRecordFrom, type ProgramCycleRow } from './programCycleRecordQuery';

export function listProgramCycles(actor: AccessTokenPayload, query: ProgramCycleQuery) {
  return sql<ProgramCycleRow[]>`
    SELECT ${programCycleRecordColumns}
    ${programCycleRecordFrom}
    WHERE ${query.programId ? sql`pc.program_id = ${query.programId}` : sql`TRUE`}
      AND ${query.scope === 'all' ? sql`TRUE` : programAccessPredicate(actor, sql`pc.program_id`)}
      AND ${query.cycleId ? sql`pc.cycle_id = ${query.cycleId}` : sql`TRUE`}
    ORDER BY cycle.starts_on DESC, pc.program_id DESC, pc.cycle_id DESC
  `;
}
