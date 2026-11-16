-- Preserve all authored text and record identities while adopting title.
ALTER TABLE public.programs RENAME COLUMN name TO title;
ALTER TABLE public.program_cycles RENAME COLUMN name TO title;

ALTER TABLE public.programs RENAME CONSTRAINT programs_name_check TO programs_title_check;
ALTER TABLE public.programs RENAME CONSTRAINT programs_name_key TO programs_title_key;
ALTER TABLE public.program_cycles RENAME CONSTRAINT program_cycles_name_check TO program_cycles_title_check;
ALTER TABLE public.program_cycles RENAME CONSTRAINT program_cycles_name_key TO program_cycles_title_key;
ALTER TABLE public.programs RENAME CONSTRAINT programs_name_not_null TO programs_title_not_null;
ALTER TABLE public.program_cycles RENAME CONSTRAINT program_cycles_name_not_null TO program_cycles_title_not_null;
