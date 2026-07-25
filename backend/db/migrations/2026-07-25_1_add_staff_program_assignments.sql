CREATE TABLE staff_program_assignments (
    staff_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, program_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_staff_program_assignments_program_id
    ON staff_program_assignments(program_id);

-- Preserve existing staff access during rollout. Admins always bypass program
-- scope, and open-attendance programs are available to every staff member.
INSERT INTO staff_program_assignments (staff_id, program_id)
SELECT u.id, p.id
FROM users u
INNER JOIN user_roles ur ON ur.id = u.role_id
CROSS JOIN programs p
WHERE ur.name = 'staff'
  AND p.roster_mode = 'enrolled'
ON CONFLICT DO NOTHING;
