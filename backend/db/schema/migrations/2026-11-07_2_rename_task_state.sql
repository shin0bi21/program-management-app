-- Keep the stored lifecycle distinct from the calculated display status.
ALTER TABLE tasks RENAME COLUMN status TO state;
ALTER TABLE tasks RENAME CONSTRAINT tasks_status_check TO tasks_state_check;
ALTER INDEX idx_tasks_category_status RENAME TO idx_tasks_category_state;
