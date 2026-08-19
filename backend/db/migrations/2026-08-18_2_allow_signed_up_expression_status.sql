CREATE OR REPLACE FUNCTION enforce_converted_expression_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM leads WHERE expression_of_interest_id = NEW.id
  ) THEN
    IF NEW.status = OLD.status THEN
      RETURN NEW;
    END IF;

    IF NEW.status = 'converted' AND OLD.status <> 'signed_up' THEN
      RETURN NEW;
    END IF;

    IF OLD.status = 'converted' AND NEW.status = 'signed_up' AND EXISTS (
      SELECT 1
      FROM leads
      WHERE expression_of_interest_id = NEW.id
        AND status = 'signed_up'
    ) THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Linked expressions of interest may only advance from converted to signed_up with their lead'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
