import { sql } from '../../db/client';

export function getSchoolReferenceData() {
  return sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM schools ORDER BY name, id
  `;
}
