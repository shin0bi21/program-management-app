-- Preserve session sorting while leaving other preferences and historical audit snapshots intact.
UPDATE public.user_preferences
SET value = jsonb_set(value, '{sorting,key}', '"title"'::jsonb),
    updated_at = NOW()
WHERE preference_key = 'session-filters'
  AND value #>> '{sorting,key}' = 'theme';
