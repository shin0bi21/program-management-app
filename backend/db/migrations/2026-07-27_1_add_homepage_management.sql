CREATE TABLE homepage_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key TEXT,
    public_path TEXT,
    alt_text VARCHAR(300) NOT NULL,
    caption VARCHAR(500) NOT NULL,
    display_order INTEGER NOT NULL CHECK (display_order >= 0),
    LIKE base_table INCLUDING ALL,
    CHECK (num_nonnulls(storage_key, public_path) = 1)
);

CREATE INDEX idx_homepage_images_display_order
    ON homepage_images(display_order, created_at);

INSERT INTO homepage_images (
    public_path,
    alt_text,
    caption,
    display_order
)
VALUES
    (
        '/programming/adventure_bay.png',
        'Youth group trip to Adventure Bay water park',
        'Our trip to Adventure Bay water park.',
        0
    ),
    (
        '/programming/community_cleanup.png',
        'Be Original community cleanup at Malden Park',
        'Be Original community cleanup at Malden Park.',
        1
    ),
    (
        '/programming/express_game.png',
        'Youth attending a Windsor Express game',
        'Our youth attend a Windsor Express game.',
        2
    ),
    (
        '/programming/food_drive.png',
        'Be Original food drive event in 2024',
        'Be Original''s first annual food drive raised over $300 for the community.',
        3
    ),
    (
        '/programming/police_guest.png',
        'Eduardo Averalo of the Windsor Police Service connecting with Be Original youth',
        'Eduardo Averalo of the Windsor Police Service connects with Be Original youth.',
        4
    ),
    (
        '/programming/police_guest2.png',
        'Windsor Police Service guest session with Be Original youth',
        'Windsor Police Service guest session with Be Original youth.',
        5
    ),
    (
        '/programming/wonderland.png',
        'Be Original trip to Canada''s Wonderland',
        'Our trip to Canada''s Wonderland.',
        6
    );

INSERT INTO user_permissions (name)
VALUES ('read:homepage'), ('write:homepage')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:homepage', 'write:homepage')
ON CONFLICT DO NOTHING;
