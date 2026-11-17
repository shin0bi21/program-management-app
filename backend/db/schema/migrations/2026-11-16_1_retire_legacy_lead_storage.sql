-- Keep the data check and retirement atomic, including against older writers.
LOCK TABLE public.leads, public.expressions_of_interest IN ACCESS EXCLUSIVE MODE;

-- Legacy records and stored interests need an explicit preservation decision.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.expressions_of_interest)
    OR EXISTS (
      SELECT 1
      FROM public.leads
      WHERE expression_of_interest_id IS NOT NULL
        OR program_of_interest_id IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'Legacy Lead intake data remains; preserve it before retiring the legacy storage'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

DROP TRIGGER expression_status_matches_lead ON public.expressions_of_interest;
DROP FUNCTION public.enforce_converted_expression_status();

ALTER TABLE public.leads
  DROP CONSTRAINT leads_origin_source_check,
  DROP COLUMN expression_of_interest_id,
  DROP COLUMN program_of_interest_id,
  ADD CONSTRAINT leads_origin_source_check CHECK (
    (origin = 'external' AND submitted_by_role IN ('youth', 'parent', 'guardian'))
    OR (origin = 'internal' AND submitted_by_role = 'staff')
  );

DROP TABLE public.expressions_of_interest;
DROP TYPE public.outreach_submitter_role;
