UPDATE user_preferences AS preference
SET value = jsonb_set(
  preference.value,
  '{statuses}',
  (
    SELECT jsonb_agg(status ORDER BY first_position)
    FROM (
      SELECT
        CASE WHEN item = '"active"'::jsonb THEN '"in_progress"'::jsonb ELSE item END AS status,
        MIN(position) AS first_position
      FROM jsonb_array_elements(preference.value->'statuses') WITH ORDINALITY AS entry(item, position)
      GROUP BY CASE WHEN item = '"active"'::jsonb THEN '"in_progress"'::jsonb ELSE item END
    ) AS renamed_statuses
  )
)
WHERE preference.preference_key = 'task-preferences'
  AND jsonb_typeof(preference.value->'statuses') = 'array'
  AND (preference.value->'statuses') ? 'active';
