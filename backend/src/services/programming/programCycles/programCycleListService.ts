import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import type { ProgramCycleQuery } from '../../../validation/programmingSchemas';
import { getProgramCycleRows, type ProgramCycleRow } from './programCycleRowQuery';
import { buildProgramCycleFilters } from './programCycleRowFilters';

/**
 * Lists matching program-cycle summaries.
 * @param actor - Actor whose program access limits scoped results.
 * @param filterValues - Validated program, cycle, and discovery selections.
 * @example listProgramCycles(actor, filterValues) // newest cycles first
 */
export function listProgramCycles(actor: AccessTokenPayload, filterValues: ProgramCycleQuery) {
  // 1. Load matching program-cycle rows.
  return sql<ProgramCycleRow[]>`
    ${getProgramCycleRows(buildProgramCycleFilters(actor, filterValues))}
    ORDER BY cycle.starts_on DESC, pc.program_id DESC, pc.cycle_id DESC
  `;
}
