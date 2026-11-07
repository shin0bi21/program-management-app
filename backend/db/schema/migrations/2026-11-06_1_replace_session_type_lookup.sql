-- Session types are fixed application values, rather than editable lookup records.
CREATE TYPE public.session_type AS ENUM ('Regular', 'Guest Speaker', 'Field Trip');

-- Fail before dropping any lookup data if an unexpected type needs an explicit mapping.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.session_types
    WHERE name NOT IN ('Regular', 'Guest Speaker', 'Field Trip')
  ) THEN
    RAISE EXCEPTION 'Unsupported session type found; map it before replacing the lookup table';
  END IF;
END;
$$;

ALTER TABLE public.program_sessions ADD COLUMN session_type public.session_type;

UPDATE public.program_sessions session
SET session_type = type.name::public.session_type
FROM public.session_types type
WHERE type.id = session.session_type_id;

ALTER TABLE public.program_sessions
  ALTER COLUMN session_type SET DEFAULT 'Regular'::public.session_type,
  ALTER COLUMN session_type SET NOT NULL;

-- Retain saved session filters while moving from UUIDs to fixed type values.
UPDATE public.user_preferences preference
SET value = (preference.value - 'sessionTypeIds') || jsonb_build_object(
    'sessionTypes', COALESCE((
      SELECT jsonb_agg(type.name ORDER BY choice.position)
      FROM jsonb_array_elements_text(preference.value->'sessionTypeIds')
        WITH ORDINALITY AS choice(id, position)
      INNER JOIN public.session_types type ON type.id::text = choice.id
    ), '[]'::jsonb)
  ),
  updated_at = NOW()
WHERE preference.preference_key = 'session-filters'
  AND jsonb_typeof(preference.value->'sessionTypeIds') = 'array';

ALTER TABLE public.program_sessions DROP COLUMN session_type_id;
DROP TABLE public.session_types;
