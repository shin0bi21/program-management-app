-- Primary contacts are emergency contacts; their type describes their relationship.
-- Lock all consumers so no obsolete value can be inserted between validation and conversion.
LOCK TABLE contacts, expressions_of_interest, leads IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM contacts WHERE type = 'emergency')
        OR EXISTS (SELECT 1 FROM expressions_of_interest WHERE contact_relationship = 'emergency')
        OR EXISTS (SELECT 1 FROM leads WHERE contact_relationship = 'emergency') THEN
        RAISE EXCEPTION 'Cannot remove emergency contact relationship while stored records use it'
            USING HINT = 'Classify those records as parent, sibling, or guardian from verified relationship information before retrying. Do not guess or delete contacts.';
    END IF;
END $$;

-- PostgreSQL cannot drop one enum value; replace the type after checking stored data.
ALTER TABLE contacts ALTER COLUMN type DROP DEFAULT;
ALTER TYPE contact_type RENAME TO contact_type_legacy;
CREATE TYPE contact_type AS ENUM ('parent', 'sibling', 'guardian');

ALTER TABLE contacts
    ALTER COLUMN type TYPE contact_type USING type::text::contact_type;
ALTER TABLE expressions_of_interest
    ALTER COLUMN contact_relationship TYPE contact_type USING contact_relationship::text::contact_type;
ALTER TABLE leads
    ALTER COLUMN contact_relationship TYPE contact_type USING contact_relationship::text::contact_type;

ALTER TABLE contacts ALTER COLUMN type SET DEFAULT 'parent'::contact_type;
DROP TYPE contact_type_legacy;
