UPDATE user_permissions
SET name = CASE name
  WHEN 'read:timesheets' THEN 'read:hours'
  WHEN 'write:timesheets' THEN 'write:hours'
END
WHERE name IN ('read:timesheets', 'write:timesheets');

UPDATE user_preferences
SET preference_key = 'hours-filters'
WHERE preference_key = 'timesheet-filters';
