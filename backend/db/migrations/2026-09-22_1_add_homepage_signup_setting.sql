CREATE TABLE homepage_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    signup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

INSERT INTO homepage_settings (id, signup_enabled)
VALUES (1, TRUE);
