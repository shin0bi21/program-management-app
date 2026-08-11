ALTER TABLE tasks DROP COLUMN cycle_id;

UPDATE user_preferences
SET value = (value - 'cycleIds')
  || CASE
    WHEN value ? 'sorting' AND value->'sorting'->>'key' <> 'cycle'
      THEN jsonb_build_object('sorting', value->'sorting')
    ELSE '{}'::jsonb
  END
  || CASE
    WHEN value ? 'columnWidths' THEN jsonb_build_object(
      'columnWidths', (value->'columnWidths') - 'cycle'
    )
    ELSE '{}'::jsonb
  END
WHERE preference_key = 'task-filters';
