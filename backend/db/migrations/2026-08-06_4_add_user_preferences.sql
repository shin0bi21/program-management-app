CREATE TABLE user_preferences (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key VARCHAR(120) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, preference_key),
    CHECK (LENGTH(BTRIM(preference_key)) > 0)
);

CREATE INDEX idx_user_preferences_updated_at
    ON user_preferences(updated_at DESC);
