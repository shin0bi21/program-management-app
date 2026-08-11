UPDATE expressions_of_interest expression
SET status = 'converted', status_updated_at = NOW(), updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM leads lead WHERE lead.expression_of_interest_id = expression.id
)
AND expression.status <> 'converted';

CREATE OR REPLACE FUNCTION enforce_converted_expression_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status <> 'converted' AND EXISTS (
    SELECT 1 FROM leads WHERE expression_of_interest_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Converted expressions of interest must retain converted status'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER expression_status_matches_lead
BEFORE UPDATE OF status
ON expressions_of_interest
FOR EACH ROW
EXECUTE FUNCTION enforce_converted_expression_status();
