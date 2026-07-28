DROP INDEX IF EXISTS idx_addresses_postal_code;
DROP INDEX IF EXISTS idx_addresses_city;

ALTER TABLE addresses
    DROP COLUMN city,
    DROP COLUMN province,
    DROP COLUMN postal_code,
    DROP COLUMN country;
