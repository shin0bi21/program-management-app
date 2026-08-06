import { sql } from '../db/client';
import type { PreferenceKey, SetPreferenceInput } from '../validation/preferenceSchemas';

export async function getPreference(userId: string, preferenceKey: PreferenceKey) {
  const rows = await sql<{ value: SetPreferenceInput }[]>`
    SELECT value
    FROM user_preferences
    WHERE user_id = ${userId} AND preference_key = ${preferenceKey}
  `;
  return rows[0]?.value ?? null;
}

export async function setPreference(
  userId: string,
  preferenceKey: PreferenceKey,
  value: SetPreferenceInput,
) {
  const rows = await sql<{ value: SetPreferenceInput }[]>`
    INSERT INTO user_preferences (user_id, preference_key, value)
    VALUES (${userId}, ${preferenceKey}, ${sql.json(value)})
    ON CONFLICT (user_id, preference_key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING value
  `;
  return rows[0].value;
}
