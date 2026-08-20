UPDATE user_preferences
SET value = jsonb_set(value, '{columnWidths}', (value->'columnWidths') - 'name')
WHERE preference_key = 'lead-filters'
  AND jsonb_typeof(value->'columnWidths') = 'object'
  AND value->'columnWidths' ? 'name';

UPDATE user_preferences
SET value = jsonb_set(value, '{columnWidths}', (value->'columnWidths') - 'youthName')
WHERE preference_key = 'expression-interest-filters'
  AND jsonb_typeof(value->'columnWidths') = 'object'
  AND value->'columnWidths' ? 'youthName';

UPDATE user_preferences
SET value = jsonb_set(
  value,
  '{hiddenColumns}',
  (
    SELECT COALESCE(jsonb_agg(column_key), '[]'::jsonb)
    FROM jsonb_array_elements(value->'hiddenColumns') AS column_key
    WHERE column_key <> to_jsonb('name'::text)
  )
)
WHERE preference_key = 'lead-filters'
  AND jsonb_typeof(value->'hiddenColumns') = 'array'
  AND value->'hiddenColumns' ? 'name';

UPDATE user_preferences
SET value = jsonb_set(
  value,
  '{hiddenColumns}',
  (
    SELECT COALESCE(jsonb_agg(column_key), '[]'::jsonb)
    FROM jsonb_array_elements(value->'hiddenColumns') AS column_key
    WHERE column_key <> to_jsonb('youthName'::text)
  )
)
WHERE preference_key = 'expression-interest-filters'
  AND jsonb_typeof(value->'hiddenColumns') = 'array'
  AND value->'hiddenColumns' ? 'youthName';
