-- Keep the stored date name consistent with Hours requests and records.
-- PostgreSQL preserves existing values and updates dependent index definitions.
ALTER TABLE time_entries RENAME COLUMN work_date TO date;
