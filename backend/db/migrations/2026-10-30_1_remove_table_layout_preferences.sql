UPDATE user_preferences
SET value = value - 'columnWidths' - 'hiddenColumns',
    updated_at = NOW()
WHERE jsonb_typeof(value) = 'object'
  AND (value ? 'columnWidths' OR value ? 'hiddenColumns');
