-- Keep existing session text and constraints while using title throughout the application.
ALTER TABLE public.program_sessions RENAME COLUMN theme TO title;

ALTER TABLE public.program_sessions
  RENAME CONSTRAINT cohort_sessions_theme_not_null TO program_sessions_title_not_null;
ALTER TABLE public.program_sessions
  RENAME CONSTRAINT cohort_sessions_focus_check TO program_sessions_title_check;
ALTER TABLE public.program_sessions
  RENAME CONSTRAINT cohort_sessions_theme_nonempty_check TO program_sessions_title_nonempty_check;

ALTER INDEX public.uq_program_sessions_program_cycle_theme_start
  RENAME TO uq_program_sessions_program_cycle_title_start;
