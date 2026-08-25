INSERT INTO user_preferences (
    user_id,
    preference_key,
    value,
    created_at,
    updated_at
)
SELECT
    user_id,
    'task-preferences',
    value,
    created_at,
    updated_at
FROM user_preferences
WHERE preference_key = 'task-filters'
ON CONFLICT (user_id, preference_key) DO UPDATE
SET value = CASE
        WHEN EXCLUDED.updated_at > user_preferences.updated_at THEN EXCLUDED.value
        ELSE user_preferences.value
    END,
    created_at = LEAST(user_preferences.created_at, EXCLUDED.created_at),
    updated_at = GREATEST(user_preferences.updated_at, EXCLUDED.updated_at);

DELETE FROM user_preferences
WHERE preference_key = 'task-filters';
