UPDATE user_preferences
SET value = jsonb_set(value, '{sorting,key}', '"cycle"'::jsonb, FALSE)
WHERE preference_key = 'session-filters'
  AND jsonb_typeof(value) = 'object'
  AND jsonb_typeof(value->'sorting') = 'object'
  AND value->'sorting'->'key' = '"cohort"'::jsonb
  AND value->'sorting'->'direction' IN ('"asc"'::jsonb, '"desc"'::jsonb);
