--
-- PostgreSQL database dump
--

\restrict z2KnMWzDlpUOur9qVgEDmdv8PlfteOTSA9ol25xOLKieANDV8InjMFcxg6EtElK

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_status AS ENUM (
    'invited',
    'active',
    'inactive'
);


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'present',
    'absent',
    'late',
    'excused'
);


--
-- Name: contact_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_type AS ENUM (
    'parent',
    'sibling',
    'guardian'
);


--
-- Name: discovery_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discovery_source AS ENUM (
    'online',
    'friend_family',
    'school',
    'community_outreach',
    'other'
);


--
-- Name: lead_origin; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_origin AS ENUM (
    'external',
    'internal'
);


--
-- Name: lead_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_status AS ENUM (
    'new',
    'contacted',
    'eligible',
    'ineligible',
    'deferred',
    'closed',
    'signed_up'
);


--
-- Name: lead_submitter_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.lead_submitter_role AS ENUM (
    'youth',
    'parent',
    'guardian',
    'staff'
);


--
-- Name: outreach_submitter_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.outreach_submitter_role AS ENUM (
    'youth',
    'parent',
    'guardian'
);


--
-- Name: program_timezone; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.program_timezone AS ENUM (
    'America/Toronto'
);


--
-- Name: enforce_converted_expression_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_converted_expression_status() RETURNS trigger
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


--
-- Name: enforce_cycle_dates_contain_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_cycle_dates_contain_sessions() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM program_sessions session
    INNER JOIN programs program ON program.id = session.program_id
    WHERE session.cycle_id = NEW.id
      AND (
        (session.starts_at AT TIME ZONE program.timezone::text)::date < NEW.starts_on
        OR (session.ends_at AT TIME ZONE program.timezone::text)::date > NEW.ends_on
      )
  ) THEN
    RAISE EXCEPTION 'Cycle dates must contain all existing sessions'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: enforce_session_attachment_has_youth_in_roster(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_session_attachment_has_youth_in_roster() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_attachments sa
        INNER JOIN program_sessions cs ON cs.id = sa.session_id
        INNER JOIN programs p ON p.id = cs.program_id
        WHERE sa.id = NEW.attachment_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM program_enrollments ce
                    WHERE ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
                      AND ce.youth_id = NEW.youth_id
                      AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      )
                )
            )
            OR (
                NOT p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.session_id = cs.id
                      AND ar.youth_id = NEW.youth_id
                      AND ar.status = 'present'
                )
            )
          )
    ) THEN
        RAISE EXCEPTION 'Session attachments can only reference youth in the session roster'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: enforce_session_note_has_youth_in_roster(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_session_note_has_youth_in_roster() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_notes sn
        INNER JOIN program_sessions cs ON cs.id = sn.session_id
        INNER JOIN programs p ON p.id = cs.program_id
        WHERE sn.id = NEW.note_id
          AND (
            (
                p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM program_enrollments ce
                    WHERE ce.program_id = cs.program_id AND ce.cycle_id = cs.cycle_id
                      AND ce.youth_id = NEW.youth_id
                      AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      )
                )
            )
            OR (
                NOT p.enrollment_required
                AND EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.session_id = cs.id
                      AND ar.youth_id = NEW.youth_id
                      AND ar.status = 'present'
                )
            )
          )
    ) THEN
        RAISE EXCEPTION 'Session notes can only reference youth in the session roster'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: enforce_session_within_cycle_dates(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_session_within_cycle_dates() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cycle_starts_on DATE;
  cycle_ends_on DATE;
  program_timezone TEXT;
BEGIN
  SELECT cycle.starts_on, cycle.ends_on, program.timezone::text
  INTO cycle_starts_on, cycle_ends_on, program_timezone
  FROM program_cycles cycle
  CROSS JOIN programs program
  WHERE cycle.id = NEW.cycle_id AND program.id = NEW.program_id;

  IF (NEW.starts_at AT TIME ZONE program_timezone)::date < cycle_starts_on
     OR (NEW.ends_at AT TIME ZONE program_timezone)::date > cycle_ends_on THEN
    RAISE EXCEPTION 'Session must fall within its program cycle date range'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    address character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT addresses_address_check CHECK ((length(TRIM(BOTH FROM address)) > 0))
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    youth_id uuid NOT NULL,
    status public.attendance_status NOT NULL,
    notes text,
    marked_at timestamp with time zone DEFAULT now() NOT NULL,
    marked_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    transaction_id uuid NOT NULL,
    user_id uuid,
    table_name character varying(100) NOT NULL,
    record_id uuid NOT NULL,
    action character varying(10) NOT NULL,
    old_data jsonb,
    new_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY (ARRAY[('INSERT'::character varying)::text, ('UPDATE'::character varying)::text, ('DELETE'::character varying)::text])))
);


--
-- Name: auth_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event character varying(50) NOT NULL,
    user_id uuid,
    email text,
    ip_hash text,
    device_fingerprint_hash text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT auth_log_event_check CHECK (((event)::text = ANY (ARRAY[('login_success'::character varying)::text, ('login_failure'::character varying)::text, ('account_locked'::character varying)::text, ('2fa_sent'::character varying)::text, ('2fa_resent'::character varying)::text, ('2fa_verified'::character varying)::text, ('2fa_failed'::character varying)::text, ('trusted_device_added'::character varying)::text, ('logout'::character varying)::text, ('password_reset_requested'::character varying)::text, ('password_reset_completed'::character varying)::text, ('token_reuse_detected'::character varying)::text])))
);


--
-- Name: base_table; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.base_table (
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone_number character varying(50),
    type public.contact_type DEFAULT 'parent'::public.contact_type NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT contacts_phone_number_check CHECK (((phone_number IS NULL) OR ((phone_number)::text ~ '^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$'::text)))
);


--
-- Name: expressions_of_interest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expressions_of_interest (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cohort_interest_submissions_id_not_null NOT NULL,
    age smallint CONSTRAINT cohort_interest_submissions_age_not_null NOT NULL,
    school character varying(160) CONSTRAINT cohort_interest_submissions_school_not_null NOT NULL,
    discovery_source public.discovery_source CONSTRAINT cohort_interest_submissions_discovery_source_not_null NOT NULL,
    notes text,
    status character varying(32) DEFAULT 'new'::character varying CONSTRAINT cohort_interest_submissions_status_not_null NOT NULL,
    status_updated_at timestamp with time zone DEFAULT now() CONSTRAINT cohort_interest_submissions_status_updated_at_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    youth_first_name character varying(80) CONSTRAINT cohort_interest_submissions_youth_first_name_not_null NOT NULL,
    youth_last_name character varying(80) CONSTRAINT cohort_interest_submissions_youth_last_name_not_null NOT NULL,
    contact_phone_number character varying(30) CONSTRAINT cohort_interest_submissions_contact_phone_number_not_null NOT NULL,
    contact_relationship public.contact_type CONSTRAINT cohort_interest_submissions_contact_relationship_not_null NOT NULL,
    submitted_by_role public.outreach_submitter_role NOT NULL,
    CONSTRAINT cohort_interest_submissions_school_check CHECK ((length(btrim((school)::text)) > 0)),
    CONSTRAINT cohort_interest_submissions_status_check CHECK (((status)::text = ANY (ARRAY[('new'::character varying)::text, ('reviewed'::character varying)::text, ('contacted'::character varying)::text, ('converted'::character varying)::text, ('signed_up'::character varying)::text, ('lost'::character varying)::text, ('spam'::character varying)::text]))),
    CONSTRAINT cohort_interest_submissions_youth_first_name_check CHECK ((length(btrim((youth_first_name)::text)) > 0)),
    CONSTRAINT cohort_interest_submissions_youth_last_name_check CHECK ((length(btrim((youth_last_name)::text)) > 0)),
    CONSTRAINT expressions_of_interest_age_check CHECK (((age >= 12) AND (age <= 19))),
    CONSTRAINT expressions_of_interest_primary_contact_check CHECK (((length(btrim((contact_phone_number)::text)) > 0) AND (contact_relationship IS NOT NULL)))
);


--
-- Name: COLUMN expressions_of_interest.submitted_by_role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.expressions_of_interest.submitted_by_role IS 'Who completed the public expression-of-interest form; null only for legacy records.';


--
-- Name: homepage_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.homepage_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    storage_key text,
    public_path text,
    alt_text character varying(300) NOT NULL,
    caption character varying(500) NOT NULL,
    display_order integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT homepage_images_check CHECK ((num_nonnulls(storage_key, public_path) = 1)),
    CONSTRAINT homepage_images_display_order_check CHECK ((display_order >= 0))
);


--
-- Name: lead_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lead_id uuid NOT NULL,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    category text NOT NULL,
    CONSTRAINT lead_notes_category_check CHECK ((category = 'follow_up'::text)),
    CONSTRAINT lead_notes_details_check CHECK ((length(btrim(details)) > 0))
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    origin public.lead_origin NOT NULL,
    expression_of_interest_id uuid,
    youth_first_name character varying(120) NOT NULL,
    youth_last_name character varying(120) NOT NULL,
    school character varying(255) NOT NULL,
    contact_phone_number character varying(40) NOT NULL,
    contact_relationship public.contact_type NOT NULL,
    discovery_source public.discovery_source NOT NULL,
    notes text,
    status public.lead_status DEFAULT 'new'::public.lead_status NOT NULL,
    status_updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    program_of_interest_id uuid,
    converted_youth_id uuid,
    submitted_by_role public.lead_submitter_role DEFAULT 'staff'::public.lead_submitter_role NOT NULL,
    date_of_birth date,
    CONSTRAINT leads_contact_phone_number_check CHECK ((length(TRIM(BOTH FROM contact_phone_number)) > 0)),
    CONSTRAINT leads_origin_source_check CHECK ((((origin = 'external'::public.lead_origin) AND (submitted_by_role = ANY (ARRAY['youth'::public.lead_submitter_role, 'parent'::public.lead_submitter_role, 'guardian'::public.lead_submitter_role]))) OR ((origin = 'internal'::public.lead_origin) AND (expression_of_interest_id IS NULL) AND (submitted_by_role = 'staff'::public.lead_submitter_role)))),
    CONSTRAINT leads_school_check CHECK ((length(TRIM(BOTH FROM school)) > 0)),
    CONSTRAINT leads_youth_first_name_check CHECK ((length(TRIM(BOTH FROM youth_first_name)) > 0)),
    CONSTRAINT leads_youth_last_name_check CHECK ((length(TRIM(BOTH FROM youth_last_name)) > 0))
);


--
-- Name: program_cycle_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_cycle_assignments (
    program_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: program_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_cycles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT program_cycles_check CHECK ((ends_on >= starts_on)),
    CONSTRAINT program_cycles_name_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: program_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_enrollments (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cohort_enrollments_id_not_null NOT NULL,
    youth_id uuid CONSTRAINT cohort_enrollments_youth_id_not_null NOT NULL,
    enrolled_on date DEFAULT ((CURRENT_TIMESTAMP AT TIME ZONE 'America/Toronto'::text))::date CONSTRAINT cohort_enrollments_enrolled_on_not_null NOT NULL,
    withdrawn_on date,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    program_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    CONSTRAINT cohort_enrollments_check CHECK (((withdrawn_on IS NULL) OR (withdrawn_on >= enrolled_on)))
);


--
-- Name: program_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.program_sessions (
    id uuid DEFAULT gen_random_uuid() CONSTRAINT cohort_sessions_id_not_null NOT NULL,
    theme character varying(160) CONSTRAINT cohort_sessions_theme_not_null NOT NULL,
    starts_at timestamp with time zone CONSTRAINT cohort_sessions_starts_at_not_null NOT NULL,
    ends_at timestamp with time zone CONSTRAINT cohort_sessions_ends_at_not_null NOT NULL,
    cancelled_at timestamp with time zone,
    description text,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    session_type_id uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid CONSTRAINT cohort_sessions_session_type_id_not_null NOT NULL,
    program_id uuid NOT NULL,
    cycle_id uuid NOT NULL,
    CONSTRAINT cohort_sessions_check CHECK ((ends_at > starts_at)),
    CONSTRAINT cohort_sessions_focus_check CHECK (((theme IS NULL) OR (length(btrim((theme)::text)) > 0))),
    CONSTRAINT cohort_sessions_theme_nonempty_check CHECK ((btrim((theme)::text) <> ''::text))
);


--
-- Name: programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    enrollment_required boolean DEFAULT true CONSTRAINT programs_roster_mode_not_null NOT NULL,
    min_age smallint,
    max_age smallint,
    default_day_of_week text DEFAULT 'tuesday'::text NOT NULL,
    default_start_time time without time zone DEFAULT '17:00:00'::time without time zone NOT NULL,
    default_end_time time without time zone DEFAULT '19:30:00'::time without time zone NOT NULL,
    timezone public.program_timezone DEFAULT 'America/Toronto'::public.program_timezone NOT NULL,
    CONSTRAINT programs_age_range_check CHECK ((((min_age IS NULL) AND (max_age IS NULL)) OR ((min_age IS NOT NULL) AND (max_age IS NOT NULL) AND (min_age >= 0) AND (max_age <= 30) AND (min_age <= max_age)))),
    CONSTRAINT programs_default_day_of_week_check CHECK ((default_day_of_week = ANY (ARRAY['sunday'::text, 'monday'::text, 'tuesday'::text, 'wednesday'::text, 'thursday'::text, 'friday'::text, 'saturday'::text]))),
    CONSTRAINT programs_default_session_time_order CHECK ((default_end_time > default_start_time)),
    CONSTRAINT programs_name_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    version character varying(255) NOT NULL,
    name text,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    checksum character varying(64)
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schools (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: session_attachment_has_youth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attachment_has_youth (
    attachment_id uuid NOT NULL,
    youth_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: session_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    title character varying(160) NOT NULL,
    description text,
    storage_key text NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(255) NOT NULL,
    file_size bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT session_attachments_file_size_check CHECK ((file_size > 0)),
    CONSTRAINT session_attachments_original_filename_check CHECK ((length(btrim((original_filename)::text)) > 0)),
    CONSTRAINT session_attachments_title_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: session_note_has_youth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_note_has_youth (
    note_id uuid CONSTRAINT session_note_youth_note_id_not_null NOT NULL,
    youth_id uuid CONSTRAINT session_note_youth_youth_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT session_note_youth_created_at_not_null NOT NULL
);


--
-- Name: session_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    category character varying(32) NOT NULL,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT session_notes_category_check CHECK (((category)::text = ANY (ARRAY[('general'::character varying)::text, ('attendance'::character varying)::text, ('behaviour'::character varying)::text, ('achievement'::character varying)::text]))),
    CONSTRAINT session_notes_details_check CHECK ((length(btrim(details)) > 0))
);


--
-- Name: session_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.session_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(80) NOT NULL
);


--
-- Name: system_revoked_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_revoked_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jti character varying(255) NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    blacklisted_at timestamp with time zone DEFAULT now(),
    reason character varying(255)
);


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tasks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    details text,
    category text NOT NULL,
    staff_id uuid NOT NULL,
    program_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    start_date date NOT NULL,
    due_date date NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT tasks_category_check CHECK ((category = ANY (ARRAY['program_delivery'::text, 'planning_prep'::text, 'meeting'::text, 'administration'::text, 'outreach'::text, 'maintenance'::text, 'other'::text]))),
    CONSTRAINT tasks_date_order_check CHECK ((start_date <= due_date)),
    CONSTRAINT tasks_status_check CHECK ((status = ANY (ARRAY['open'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT tasks_title_check CHECK ((length(TRIM(BOTH FROM title)) > 0))
);


--
-- Name: time_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.time_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    program_id uuid,
    category text CONSTRAINT time_entries_task_not_null NOT NULL,
    work_date date NOT NULL,
    hours numeric(5,2) NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    cycle_id uuid NOT NULL,
    task_id uuid,
    session_id uuid,
    CONSTRAINT time_entries_category_check CHECK ((category = ANY (ARRAY['program_delivery'::text, 'planning_prep'::text, 'meeting'::text, 'administration'::text, 'outreach'::text, 'maintenance'::text, 'other'::text]))),
    CONSTRAINT time_entries_hours_check CHECK (((hours > (0)::numeric) AND (hours <= (24)::numeric))),
    CONSTRAINT time_entries_note_check CHECK ((length(TRIM(BOTH FROM note)) > 0)),
    CONSTRAINT time_entries_program_delivery_link_check CHECK (((category <> 'program_delivery'::text) OR (task_id IS NOT NULL) OR (session_id IS NOT NULL))),
    CONSTRAINT time_entries_program_delivery_source_check CHECK (((session_id IS NULL) OR (category = 'program_delivery'::text))),
    CONSTRAINT time_entries_single_source_check CHECK ((num_nonnulls(task_id, session_id) <= 1))
);


--
-- Name: user_auth_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_auth_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    code character varying(6) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_code CHECK (((code)::text ~ '^[0-9]{6}$'::text))
);


--
-- Name: user_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    email_verified boolean DEFAULT false,
    last_login timestamp with time zone,
    failed_login_attempts smallint DEFAULT 0,
    locked_until timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid,
    status public.account_status DEFAULT 'invited'::public.account_status NOT NULL,
    CONSTRAINT user_credentials_email_check CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT user_credentials_failed_login_attempts_check CHECK ((failed_login_attempts >= 0))
);


--
-- Name: user_has_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_has_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    address_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_has_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_has_contacts (
    user_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token character varying(255) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(128) NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_preferences (
    user_id uuid NOT NULL,
    preference_key character varying(120) NOT NULL,
    value jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_preferences_preference_key_check CHECK ((length(btrim((preference_key)::text)) > 0))
);


--
-- Name: user_program_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_program_assignments (
    user_id uuid CONSTRAINT staff_program_assignments_staff_id_not_null NOT NULL,
    program_id uuid CONSTRAINT staff_program_assignments_program_id_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT staff_program_assignments_created_at_not_null NOT NULL,
    created_by uuid
);


--
-- Name: user_refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_refresh_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    jti character varying(255) NOT NULL,
    token_hash character varying(255) NOT NULL,
    token_family uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_role_has_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_has_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(64) NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid
);


--
-- Name: user_trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_trusted_devices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    device_hash character varying(255) NOT NULL,
    device_name character varying(255),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    role_id uuid NOT NULL,
    first_name character varying(120) NOT NULL,
    last_name character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT users_first_name_check CHECK ((length(TRIM(BOTH FROM first_name)) > 0)),
    CONSTRAINT users_last_name_check CHECK ((length(TRIM(BOTH FROM last_name)) > 0))
);


--
-- Name: youth_profile_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youth_profile_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    youth_id uuid NOT NULL,
    category character varying(32) NOT NULL,
    details text NOT NULL,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null1 NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT youth_profile_notes_category_check CHECK (((category)::text = ANY (ARRAY[('general'::character varying)::text, ('health'::character varying)::text, ('preference'::character varying)::text]))),
    CONSTRAINT youth_profile_notes_details_check CHECK ((length(btrim(details)) > 0))
);


--
-- Name: youth_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.youth_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    date_of_birth date,
    school_id uuid,
    created_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_created_at_not_null NOT NULL,
    updated_at timestamp with time zone DEFAULT now() CONSTRAINT base_table_updated_at_not_null NOT NULL,
    created_by uuid,
    updated_by uuid,
    CONSTRAINT youth_profiles_date_of_birth_check CHECK (((date_of_birth IS NULL) OR (date_of_birth < CURRENT_DATE)))
);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_session_id_youth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_youth_id_key UNIQUE (session_id, youth_id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_log auth_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_log
    ADD CONSTRAINT auth_log_pkey PRIMARY KEY (id);


--
-- Name: program_enrollments cohort_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT cohort_enrollments_pkey PRIMARY KEY (id);


--
-- Name: expressions_of_interest cohort_interest_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expressions_of_interest
    ADD CONSTRAINT cohort_interest_submissions_pkey PRIMARY KEY (id);


--
-- Name: program_sessions cohort_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_sessions
    ADD CONSTRAINT cohort_sessions_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: homepage_images homepage_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.homepage_images
    ADD CONSTRAINT homepage_images_pkey PRIMARY KEY (id);


--
-- Name: lead_notes lead_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_pkey PRIMARY KEY (id);


--
-- Name: leads leads_converted_youth_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_youth_id_key UNIQUE (converted_youth_id);


--
-- Name: leads leads_interest_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_interest_submission_id_key UNIQUE (expression_of_interest_id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: program_cycle_assignments program_cycle_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycle_assignments
    ADD CONSTRAINT program_cycle_assignments_pkey PRIMARY KEY (program_id, cycle_id);


--
-- Name: program_cycles program_cycles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycles
    ADD CONSTRAINT program_cycles_name_key UNIQUE (name);


--
-- Name: program_cycles program_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycles
    ADD CONSTRAINT program_cycles_pkey PRIMARY KEY (id);


--
-- Name: programs programs_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_name_key UNIQUE (name);


--
-- Name: programs programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programs
    ADD CONSTRAINT programs_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_version_key UNIQUE (version);


--
-- Name: schools schools_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_name_key UNIQUE (name);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (id);


--
-- Name: session_attachment_has_youth session_attachment_has_youth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachment_has_youth
    ADD CONSTRAINT session_attachment_has_youth_pkey PRIMARY KEY (attachment_id, youth_id);


--
-- Name: session_attachments session_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_pkey PRIMARY KEY (id);


--
-- Name: session_attachments session_attachments_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_storage_key_key UNIQUE (storage_key);


--
-- Name: session_note_has_youth session_note_has_youth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_note_has_youth
    ADD CONSTRAINT session_note_has_youth_pkey PRIMARY KEY (note_id, youth_id);


--
-- Name: session_notes session_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_pkey PRIMARY KEY (id);


--
-- Name: session_types session_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_types
    ADD CONSTRAINT session_types_name_key UNIQUE (name);


--
-- Name: session_types session_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_types
    ADD CONSTRAINT session_types_pkey PRIMARY KEY (id);


--
-- Name: system_revoked_tokens system_revoked_tokens_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_revoked_tokens
    ADD CONSTRAINT system_revoked_tokens_jti_key UNIQUE (jti);


--
-- Name: system_revoked_tokens system_revoked_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_revoked_tokens
    ADD CONSTRAINT system_revoked_tokens_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: time_entries time_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_pkey PRIMARY KEY (id);


--
-- Name: program_enrollments uq_program_enrollments_program_cycle_youth; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT uq_program_enrollments_program_cycle_youth UNIQUE (program_id, cycle_id, youth_id);


--
-- Name: user_auth_codes user_auth_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth_codes
    ADD CONSTRAINT user_auth_codes_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_email_key UNIQUE (email);


--
-- Name: user_credentials user_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_pkey PRIMARY KEY (id);


--
-- Name: user_credentials user_credentials_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT user_credentials_user_id_key UNIQUE (user_id);


--
-- Name: user_has_addresses user_has_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT user_has_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_has_addresses user_has_addresses_user_id_address_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT user_has_addresses_user_id_address_id_key UNIQUE (user_id, address_id);


--
-- Name: user_has_contacts user_has_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_contacts
    ADD CONSTRAINT user_has_contacts_pkey PRIMARY KEY (user_id, contact_id);


--
-- Name: user_password_reset_tokens user_password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_password_reset_tokens
    ADD CONSTRAINT user_password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_password_reset_tokens user_password_reset_tokens_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_password_reset_tokens
    ADD CONSTRAINT user_password_reset_tokens_token_key UNIQUE (token);


--
-- Name: user_permissions user_permissions_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_name_key UNIQUE (name);


--
-- Name: user_permissions user_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT user_permissions_pkey PRIMARY KEY (id);


--
-- Name: user_preferences user_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id, preference_key);


--
-- Name: user_program_assignments user_program_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_program_assignments
    ADD CONSTRAINT user_program_assignments_pkey PRIMARY KEY (user_id, program_id);


--
-- Name: user_refresh_tokens user_refresh_tokens_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_jti_key UNIQUE (jti);


--
-- Name: user_refresh_tokens user_refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_role_has_permissions user_role_has_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_has_permissions
    ADD CONSTRAINT user_role_has_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: user_roles user_roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_name_key UNIQUE (name);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_trusted_devices user_trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_trusted_devices
    ADD CONSTRAINT user_trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: user_trusted_devices user_trusted_devices_user_id_device_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_trusted_devices
    ADD CONSTRAINT user_trusted_devices_user_id_device_hash_key UNIQUE (user_id, device_hash);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: youth_profile_notes youth_profile_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profile_notes
    ADD CONSTRAINT youth_profile_notes_pkey PRIMARY KEY (id);


--
-- Name: youth_profiles youth_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT youth_profiles_pkey PRIMARY KEY (id);


--
-- Name: youth_profiles youth_profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT youth_profiles_user_id_key UNIQUE (user_id);


--
-- Name: idx_attendance_records_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_session_id ON public.attendance_records USING btree (session_id);


--
-- Name: idx_attendance_records_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendance_records_youth_id ON public.attendance_records USING btree (youth_id);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_record ON public.audit_log USING btree (table_name, record_id);


--
-- Name: idx_audit_log_transaction_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_transaction_id ON public.audit_log USING btree (transaction_id);


--
-- Name: idx_audit_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);


--
-- Name: idx_auth_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_log_created_at ON public.auth_log USING btree (created_at DESC);


--
-- Name: idx_auth_log_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_log_event ON public.auth_log USING btree (event);


--
-- Name: idx_auth_log_ip_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_log_ip_hash ON public.auth_log USING btree (ip_hash);


--
-- Name: idx_auth_log_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_auth_log_user_id ON public.auth_log USING btree (user_id);


--
-- Name: idx_cohort_enrollments_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_enrollments_youth_id ON public.program_enrollments USING btree (youth_id);


--
-- Name: idx_cohort_interest_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_interest_submissions_created_at ON public.expressions_of_interest USING btree (created_at DESC);


--
-- Name: idx_cohort_interest_submissions_discovery_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_interest_submissions_discovery_source ON public.expressions_of_interest USING btree (discovery_source);


--
-- Name: idx_cohort_interest_submissions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_interest_submissions_status ON public.expressions_of_interest USING btree (status);


--
-- Name: idx_cohort_sessions_starts_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cohort_sessions_starts_at ON public.program_sessions USING btree (starts_at);


--
-- Name: idx_contacts_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_type ON public.contacts USING btree (type);


--
-- Name: idx_homepage_images_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_homepage_images_display_order ON public.homepage_images USING btree (display_order, created_at);


--
-- Name: idx_lead_notes_lead_id_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lead_notes_lead_id_created_at ON public.lead_notes USING btree (lead_id, created_at DESC);


--
-- Name: idx_leads_converted_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_converted_youth_id ON public.leads USING btree (converted_youth_id);


--
-- Name: idx_leads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_at ON public.leads USING btree (created_at DESC);


--
-- Name: idx_leads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_created_by ON public.leads USING btree (created_by);


--
-- Name: idx_leads_origin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_origin ON public.leads USING btree (origin);


--
-- Name: idx_leads_origin_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_origin_created_at ON public.leads USING btree (origin, created_at DESC);


--
-- Name: idx_leads_program_of_interest_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_program_of_interest_id ON public.leads USING btree (program_of_interest_id);


--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status);


--
-- Name: idx_program_cycle_assignments_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_cycle_assignments_cycle ON public.program_cycle_assignments USING btree (cycle_id);


--
-- Name: idx_program_cycles_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_cycles_dates ON public.program_cycles USING btree (starts_on, ends_on);


--
-- Name: idx_program_enrollments_program_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_enrollments_program_cycle ON public.program_enrollments USING btree (program_id, cycle_id);


--
-- Name: idx_program_sessions_program_cycle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_sessions_program_cycle ON public.program_sessions USING btree (program_id, cycle_id);


--
-- Name: idx_schema_migrations_applied_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schema_migrations_applied_at ON public.schema_migrations USING btree (applied_at DESC);


--
-- Name: idx_schema_migrations_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schema_migrations_version ON public.schema_migrations USING btree (version);


--
-- Name: idx_schools_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_schools_name ON public.schools USING btree (name);


--
-- Name: idx_session_attachment_has_youth_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_attachment_has_youth_youth_id ON public.session_attachment_has_youth USING btree (youth_id);


--
-- Name: idx_session_attachments_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_attachments_session_id ON public.session_attachments USING btree (session_id, created_at DESC);


--
-- Name: idx_session_note_has_youth_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_note_has_youth_youth_id ON public.session_note_has_youth USING btree (youth_id);


--
-- Name: idx_session_notes_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_session_notes_session_id ON public.session_notes USING btree (session_id);


--
-- Name: idx_system_revoked_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_revoked_tokens_expires ON public.system_revoked_tokens USING btree (expires_at);


--
-- Name: idx_system_revoked_tokens_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_revoked_tokens_jti ON public.system_revoked_tokens USING btree (jti);


--
-- Name: idx_system_revoked_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_revoked_tokens_token_hash ON public.system_revoked_tokens USING btree (token_hash);


--
-- Name: idx_system_revoked_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_revoked_tokens_user_id ON public.system_revoked_tokens USING btree (user_id);


--
-- Name: idx_tasks_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_category_status ON public.tasks USING btree (category, status);


--
-- Name: idx_tasks_date_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_date_range ON public.tasks USING btree (start_date, due_date);


--
-- Name: idx_tasks_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_program ON public.tasks USING btree (program_id) WHERE (program_id IS NOT NULL);


--
-- Name: idx_tasks_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tasks_staff ON public.tasks USING btree (staff_id, start_date, due_date);


--
-- Name: idx_time_entries_category_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_category_date ON public.time_entries USING btree (category, work_date);


--
-- Name: idx_time_entries_cycle_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_cycle_date ON public.time_entries USING btree (cycle_id, work_date);


--
-- Name: idx_time_entries_program_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_program_date ON public.time_entries USING btree (program_id, work_date);


--
-- Name: idx_time_entries_session_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_session_id ON public.time_entries USING btree (session_id) WHERE (session_id IS NOT NULL);


--
-- Name: idx_time_entries_staff_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_staff_date ON public.time_entries USING btree (staff_id, work_date);


--
-- Name: idx_time_entries_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_time_entries_task_id ON public.time_entries USING btree (task_id) WHERE (task_id IS NOT NULL);


--
-- Name: idx_urhp_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_urhp_created_by ON public.user_role_has_permissions USING btree (created_by);


--
-- Name: idx_user_auth_codes_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_codes_code ON public.user_auth_codes USING btree (code);


--
-- Name: idx_user_auth_codes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_auth_codes_user_id ON public.user_auth_codes USING btree (user_id);


--
-- Name: idx_user_credentials_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_credentials_email ON public.user_credentials USING btree (email);


--
-- Name: idx_user_credentials_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_credentials_status ON public.user_credentials USING btree (status);


--
-- Name: idx_user_credentials_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_credentials_user_id ON public.user_credentials USING btree (user_id);


--
-- Name: idx_user_has_addresses_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_has_addresses_active ON public.user_has_addresses USING btree (active);


--
-- Name: idx_user_has_addresses_address_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_has_addresses_address_id ON public.user_has_addresses USING btree (address_id);


--
-- Name: idx_user_has_addresses_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_has_addresses_user_id ON public.user_has_addresses USING btree (user_id);


--
-- Name: idx_user_has_contacts_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_has_contacts_active ON public.user_has_contacts USING btree (active);


--
-- Name: idx_user_password_reset_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_password_reset_token ON public.user_password_reset_tokens USING btree (token);


--
-- Name: idx_user_password_reset_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_password_reset_user ON public.user_password_reset_tokens USING btree (user_id);


--
-- Name: idx_user_permissions_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_permissions_created_by ON public.user_permissions USING btree (created_by);


--
-- Name: idx_user_preferences_updated_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_preferences_updated_at ON public.user_preferences USING btree (updated_at DESC);


--
-- Name: idx_user_program_assignments_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_program_assignments_program_id ON public.user_program_assignments USING btree (program_id);


--
-- Name: idx_user_refresh_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_refresh_tokens_expires ON public.user_refresh_tokens USING btree (expires_at);


--
-- Name: idx_user_refresh_tokens_family; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_refresh_tokens_family ON public.user_refresh_tokens USING btree (token_family);


--
-- Name: idx_user_refresh_tokens_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_refresh_tokens_jti ON public.user_refresh_tokens USING btree (jti);


--
-- Name: idx_user_refresh_tokens_token_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_refresh_tokens_token_hash ON public.user_refresh_tokens USING btree (token_hash);


--
-- Name: idx_user_refresh_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_refresh_tokens_user_id ON public.user_refresh_tokens USING btree (user_id);


--
-- Name: idx_user_role_has_permissions_permission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_has_permissions_permission_id ON public.user_role_has_permissions USING btree (permission_id);


--
-- Name: idx_user_role_has_permissions_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_role_has_permissions_role_id ON public.user_role_has_permissions USING btree (role_id);


--
-- Name: idx_user_roles_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_roles_created_by ON public.user_roles USING btree (created_by);


--
-- Name: idx_user_trusted_devices_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_trusted_devices_expires ON public.user_trusted_devices USING btree (expires_at);


--
-- Name: idx_user_trusted_devices_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_trusted_devices_hash ON public.user_trusted_devices USING btree (device_hash);


--
-- Name: idx_user_trusted_devices_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_trusted_devices_user_id ON public.user_trusted_devices USING btree (user_id);


--
-- Name: idx_users_role_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role_id ON public.users USING btree (role_id);


--
-- Name: idx_youth_profile_notes_youth_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youth_profile_notes_youth_id ON public.youth_profile_notes USING btree (youth_id, created_at DESC);


--
-- Name: idx_youth_profiles_school_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youth_profiles_school_id ON public.youth_profiles USING btree (school_id);


--
-- Name: idx_youth_profiles_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_youth_profiles_user_id ON public.youth_profiles USING btree (user_id);


--
-- Name: uq_program_sessions_program_cycle_theme_start; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_program_sessions_program_cycle_theme_start ON public.program_sessions USING btree (program_id, cycle_id, theme, starts_at) NULLS NOT DISTINCT;


--
-- Name: expressions_of_interest expression_status_matches_lead; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER expression_status_matches_lead BEFORE UPDATE OF status ON public.expressions_of_interest FOR EACH ROW EXECUTE FUNCTION public.enforce_converted_expression_status();


--
-- Name: program_cycles program_cycle_dates_contain_sessions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER program_cycle_dates_contain_sessions BEFORE UPDATE OF starts_on, ends_on ON public.program_cycles FOR EACH ROW EXECUTE FUNCTION public.enforce_cycle_dates_contain_sessions();


--
-- Name: program_sessions program_sessions_within_cycle_dates; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER program_sessions_within_cycle_dates BEFORE INSERT OR UPDATE OF program_id, cycle_id, starts_at, ends_at ON public.program_sessions FOR EACH ROW EXECUTE FUNCTION public.enforce_session_within_cycle_dates();


--
-- Name: session_attachment_has_youth session_attachment_has_youth_in_roster; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_attachment_has_youth_in_roster BEFORE INSERT OR UPDATE OF attachment_id, youth_id ON public.session_attachment_has_youth FOR EACH ROW EXECUTE FUNCTION public.enforce_session_attachment_has_youth_in_roster();


--
-- Name: session_note_has_youth session_note_has_youth_in_roster; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER session_note_has_youth_in_roster BEFORE INSERT OR UPDATE OF note_id, youth_id ON public.session_note_has_youth FOR EACH ROW EXECUTE FUNCTION public.enforce_session_note_has_youth_in_roster();


--
-- Name: attendance_records attendance_records_marked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_marked_by_fkey FOREIGN KEY (marked_by) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.program_sessions(id) ON DELETE RESTRICT;


--
-- Name: attendance_records attendance_records_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE RESTRICT;


--
-- Name: program_enrollments cohort_enrollments_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT cohort_enrollments_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE RESTRICT;


--
-- Name: program_sessions cohort_sessions_session_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_sessions
    ADD CONSTRAINT cohort_sessions_session_type_id_fkey FOREIGN KEY (session_type_id) REFERENCES public.session_types(id) ON DELETE RESTRICT;


--
-- Name: addresses fk_addresses_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_addresses_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: addresses fk_addresses_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT fk_addresses_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_enrollments fk_cohort_enrollments_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT fk_cohort_enrollments_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_enrollments fk_cohort_enrollments_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT fk_cohort_enrollments_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_sessions fk_cohort_sessions_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_sessions
    ADD CONSTRAINT fk_cohort_sessions_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_sessions fk_cohort_sessions_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_sessions
    ADD CONSTRAINT fk_cohort_sessions_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts fk_contacts_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT fk_contacts_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: contacts fk_contacts_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT fk_contacts_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_credentials fk_creds_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT fk_creds_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_credentials fk_creds_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT fk_creds_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_notes fk_lead_notes_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT fk_lead_notes_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_notes fk_lead_notes_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT fk_lead_notes_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_cycles fk_program_cycles_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycles
    ADD CONSTRAINT fk_program_cycles_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_cycles fk_program_cycles_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycles
    ADD CONSTRAINT fk_program_cycles_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_enrollments fk_program_enrollments_assignment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_enrollments
    ADD CONSTRAINT fk_program_enrollments_assignment FOREIGN KEY (program_id, cycle_id) REFERENCES public.program_cycle_assignments(program_id, cycle_id) ON DELETE RESTRICT;


--
-- Name: program_sessions fk_program_sessions_assignment; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_sessions
    ADD CONSTRAINT fk_program_sessions_assignment FOREIGN KEY (program_id, cycle_id) REFERENCES public.program_cycle_assignments(program_id, cycle_id) ON DELETE CASCADE;


--
-- Name: schools fk_schools_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT fk_schools_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: schools fk_schools_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT fk_schools_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: session_attachments fk_session_attachments_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT fk_session_attachments_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: session_attachments fk_session_attachments_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT fk_session_attachments_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: session_notes fk_session_notes_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT fk_session_notes_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: session_notes fk_session_notes_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT fk_session_notes_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: system_revoked_tokens fk_system_revoked_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_revoked_tokens
    ADD CONSTRAINT fk_system_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks fk_tasks_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tasks fk_tasks_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT fk_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: time_entries fk_time_entries_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT fk_time_entries_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: time_entries fk_time_entries_cycle; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT fk_time_entries_cycle FOREIGN KEY (cycle_id) REFERENCES public.program_cycles(id) ON DELETE RESTRICT;


--
-- Name: time_entries fk_time_entries_program_cycle; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT fk_time_entries_program_cycle FOREIGN KEY (program_id, cycle_id) REFERENCES public.program_cycle_assignments(program_id, cycle_id) ON DELETE RESTRICT;


--
-- Name: time_entries fk_time_entries_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT fk_time_entries_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_has_addresses fk_uha_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT fk_uha_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_has_addresses fk_uha_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT fk_uha_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_has_contacts fk_uhc_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_contacts
    ADD CONSTRAINT fk_uhc_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_has_contacts fk_uhc_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_contacts
    ADD CONSTRAINT fk_uhc_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_role_has_permissions fk_urhp_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_has_permissions
    ADD CONSTRAINT fk_urhp_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_role_has_permissions fk_urhp_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_has_permissions
    ADD CONSTRAINT fk_urhp_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_credentials fk_user_credentials_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_credentials
    ADD CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_password_reset_tokens fk_user_password_reset_tokens_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_password_reset_tokens
    ADD CONSTRAINT fk_user_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_permissions fk_user_permissions_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT fk_user_permissions_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_permissions fk_user_permissions_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_permissions
    ADD CONSTRAINT fk_user_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles fk_user_roles_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_roles fk_user_roles_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT fk_user_roles_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: users fk_users_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: youth_profiles fk_youth_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT fk_youth_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: youth_profile_notes fk_youth_profile_notes_created_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profile_notes
    ADD CONSTRAINT fk_youth_profile_notes_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: youth_profile_notes fk_youth_profile_notes_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profile_notes
    ADD CONSTRAINT fk_youth_profile_notes_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: youth_profiles fk_youth_profiles_school; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT fk_youth_profiles_school FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;


--
-- Name: youth_profiles fk_youth_profiles_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT fk_youth_profiles_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: youth_profiles fk_youth_updated_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profiles
    ADD CONSTRAINT fk_youth_updated_by FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: lead_notes lead_notes_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_notes
    ADD CONSTRAINT lead_notes_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;


--
-- Name: leads leads_converted_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_converted_youth_id_fkey FOREIGN KEY (converted_youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE SET NULL;


--
-- Name: leads leads_interest_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_interest_submission_id_fkey FOREIGN KEY (expression_of_interest_id) REFERENCES public.expressions_of_interest(id) ON DELETE RESTRICT;


--
-- Name: leads leads_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_program_id_fkey FOREIGN KEY (program_of_interest_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: program_cycle_assignments program_cycle_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycle_assignments
    ADD CONSTRAINT program_cycle_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: program_cycle_assignments program_cycle_assignments_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycle_assignments
    ADD CONSTRAINT program_cycle_assignments_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.program_cycles(id) ON DELETE RESTRICT;


--
-- Name: program_cycle_assignments program_cycle_assignments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycle_assignments
    ADD CONSTRAINT program_cycle_assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: program_cycle_assignments program_cycle_assignments_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_cycle_assignments
    ADD CONSTRAINT program_cycle_assignments_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: session_attachment_has_youth session_attachment_has_youth_attachment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachment_has_youth
    ADD CONSTRAINT session_attachment_has_youth_attachment_id_fkey FOREIGN KEY (attachment_id) REFERENCES public.session_attachments(id) ON DELETE CASCADE;


--
-- Name: session_attachment_has_youth session_attachment_has_youth_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachment_has_youth
    ADD CONSTRAINT session_attachment_has_youth_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE RESTRICT;


--
-- Name: session_attachments session_attachments_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_attachments
    ADD CONSTRAINT session_attachments_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.program_sessions(id) ON DELETE RESTRICT;


--
-- Name: session_note_has_youth session_note_youth_note_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_note_has_youth
    ADD CONSTRAINT session_note_youth_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.session_notes(id) ON DELETE CASCADE;


--
-- Name: session_note_has_youth session_note_youth_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_note_has_youth
    ADD CONSTRAINT session_note_youth_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE RESTRICT;


--
-- Name: session_notes session_notes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.session_notes
    ADD CONSTRAINT session_notes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.program_sessions(id) ON DELETE RESTRICT;


--
-- Name: user_program_assignments staff_program_assignments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_program_assignments
    ADD CONSTRAINT staff_program_assignments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_program_assignments staff_program_assignments_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_program_assignments
    ADD CONSTRAINT staff_program_assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE CASCADE;


--
-- Name: user_program_assignments staff_program_assignments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_program_assignments
    ADD CONSTRAINT staff_program_assignments_staff_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tasks tasks_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: tasks tasks_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: time_entries time_entries_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id) ON DELETE RESTRICT;


--
-- Name: time_entries time_entries_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.program_sessions(id) ON DELETE RESTRICT;


--
-- Name: time_entries time_entries_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.users(id) ON DELETE RESTRICT;


--
-- Name: time_entries time_entries_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.time_entries
    ADD CONSTRAINT time_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE RESTRICT;


--
-- Name: user_auth_codes user_auth_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_auth_codes
    ADD CONSTRAINT user_auth_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_has_addresses user_has_addresses_address_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT user_has_addresses_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE CASCADE;


--
-- Name: user_has_addresses user_has_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_addresses
    ADD CONSTRAINT user_has_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_has_contacts user_has_contacts_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_contacts
    ADD CONSTRAINT user_has_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: user_has_contacts user_has_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_has_contacts
    ADD CONSTRAINT user_has_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_preferences user_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT user_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_refresh_tokens user_refresh_tokens_replaced_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_replaced_by_fkey FOREIGN KEY (replaced_by) REFERENCES public.user_refresh_tokens(id) ON DELETE SET NULL;


--
-- Name: user_refresh_tokens user_refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_refresh_tokens
    ADD CONSTRAINT user_refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_role_has_permissions user_role_has_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_has_permissions
    ADD CONSTRAINT user_role_has_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.user_permissions(id) ON DELETE CASCADE;


--
-- Name: user_role_has_permissions user_role_has_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_has_permissions
    ADD CONSTRAINT user_role_has_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id) ON DELETE CASCADE;


--
-- Name: user_trusted_devices user_trusted_devices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_trusted_devices
    ADD CONSTRAINT user_trusted_devices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id);


--
-- Name: youth_profile_notes youth_profile_notes_youth_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.youth_profile_notes
    ADD CONSTRAINT youth_profile_notes_youth_id_fkey FOREIGN KEY (youth_id) REFERENCES public.youth_profiles(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict z2KnMWzDlpUOur9qVgEDmdv8PlfteOTSA9ol25xOLKieANDV8InjMFcxg6EtElK

