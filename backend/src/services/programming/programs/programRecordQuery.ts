import { sql } from '../../../db/client';
import type { Programs } from '../../../types/database';
import type { DbRow } from '../../../types/db';

export type ProgramRow = DbRow<Pick<Programs,
  'id' | 'name' | 'description' | 'enrollment_required' | 'min_age' | 'max_age'
  | 'default_day_of_week' | 'default_start_time' | 'default_end_time' | 'timezone'
>>;

export const programRecordColumns = sql`
  p.id, p.name, p.description, p.enrollment_required, p.min_age, p.max_age, p.default_day_of_week,
  to_char(p.default_start_time, 'HH24:MI') AS default_start_time,
  to_char(p.default_end_time, 'HH24:MI') AS default_end_time, p.timezone
`;
