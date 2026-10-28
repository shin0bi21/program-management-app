ALTER TABLE programs
  ADD COLUMN default_day_of_week TEXT NOT NULL DEFAULT 'tuesday'
    CHECK (default_day_of_week IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  ADD COLUMN default_start_time TIME NOT NULL DEFAULT '17:00',
  ADD COLUMN default_end_time TIME NOT NULL DEFAULT '19:30',
  ADD COLUMN timezone TEXT NOT NULL DEFAULT 'America/Toronto' CHECK (length(timezone) > 0),
  ADD CONSTRAINT programs_default_session_time_order CHECK (default_end_time > default_start_time);
