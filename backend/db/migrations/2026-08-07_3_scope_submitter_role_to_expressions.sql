UPDATE expressions_of_interest
SET submitted_by_role = 'parent'
WHERE submitted_by_role IS NULL;

ALTER TABLE expressions_of_interest
    ALTER COLUMN submitted_by_role SET NOT NULL;

ALTER TABLE leads
    DROP COLUMN submitted_by_role;
