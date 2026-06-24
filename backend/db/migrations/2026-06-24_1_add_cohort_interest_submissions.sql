CREATE TYPE discovery_source AS ENUM (
    'online',
    'friend_family',
    'school',
    'community_outreach',
    'other'
);

CREATE TABLE cohort_interest_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youth_name VARCHAR(160) NOT NULL,
    parent_name VARCHAR(160),
    age SMALLINT NOT NULL CHECK (age BETWEEN 1 AND 120),
    school VARCHAR(160),
    email VARCHAR(255),
    phone_number VARCHAR(30),
    discovery_source discovery_source,
    message TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'closed')),
    LIKE base_table INCLUDING ALL,
    CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CHECK (LENGTH(TRIM(youth_name)) > 0),
    CHECK (
        COALESCE(NULLIF(BTRIM(email), ''), NULLIF(BTRIM(phone_number), '')) IS NOT NULL
    )
);

CREATE INDEX idx_cohort_interest_submissions_created_at
    ON cohort_interest_submissions(created_at DESC);

CREATE INDEX idx_cohort_interest_submissions_status
    ON cohort_interest_submissions(status);

CREATE INDEX idx_cohort_interest_submissions_email
    ON cohort_interest_submissions(email);

CREATE INDEX idx_cohort_interest_submissions_discovery_source
    ON cohort_interest_submissions(discovery_source);
