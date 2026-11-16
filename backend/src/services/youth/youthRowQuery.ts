import { sql } from '../../db/client';
import type { Contacts, Users, YouthProfiles } from '../../types/database';
import type { DbRow } from '../../types/db';

export type YouthRow =
  DbRow<Pick<Users, 'id' | 'first_name' | 'last_name' | 'created_at'>> &
  {
    /** Calendar date in YYYY-MM-DD format, or null when unknown. */
    dateOfBirth: string | null;
    schoolId: YouthProfiles['school_id'];
    schoolName: string | null;
    account: { email: string; status: 'invited' | 'active' | 'inactive' } | null;
    activeProgram: { programId: string; program: string } | null;
    addresses: Array<{ id: string; address: string }> | null;
    contacts: Array<DbRow<Pick<Contacts, 'id' | 'phone_number' | 'type'>>> | null;
  };

/**
 * Builds youth profiles for table lists, direct reads, and save responses.
 * @param appliedFilters - Additional SQL conditions using the youth, profile, or school aliases.
 * @param query - Database connection to use; pass trx to read inside an existing transaction.
 * @returns An unexecuted query for matching profiles, including the active program and contacts.
 * @example getYouthRows(sql`youth.id = ${youthId}`) // query for one youth
 */
export function getYouthRows(appliedFilters = sql`TRUE`, query = sql) {
  return query<YouthRow[]>`
    SELECT
      youth.id,
      youth.first_name,
      youth.last_name,
      youth.created_at,

      profile.date_of_birth,
      profile.school_id,

      school.name AS school_name,

      CASE
        WHEN credentials.user_id IS NULL THEN NULL
        ELSE json_build_object(
          'email', credentials.email,
          'status', credentials.status
        )
      END AS account,
      (
        SELECT json_build_object(
          'programId', program.id,
          'program', program.title
        )
        FROM programs program
        WHERE program.enrollment_required = TRUE
          AND EXISTS (
            SELECT 1
            FROM program_enrollments enrollment
            INNER JOIN program_cycles cycle ON cycle.id = enrollment.cycle_id
            WHERE enrollment.program_id = program.id AND enrollment.youth_id = youth.id
              AND enrollment.enrolled_on <= CURRENT_DATE
              AND (enrollment.withdrawn_on IS NULL OR enrollment.withdrawn_on > CURRENT_DATE)
              AND CURRENT_DATE BETWEEN cycle.starts_on AND cycle.ends_on
          )
      ) AS active_program,
      (
        SELECT json_agg(
          json_build_object(
            'id', address.id,
            'address', address.address
          )
        )
        FROM addresses address
        INNER JOIN user_has_addresses address_link ON address_link.address_id = address.id
        WHERE address_link.user_id = youth.id AND address_link.active = true
      ) AS addresses,
      (
        SELECT json_agg(
          json_build_object(
            'id', contact.id,
            'phoneNumber', contact.phone_number,
            'type', contact.type
          )
        )
        FROM contacts contact
        INNER JOIN user_has_contacts contact_link ON contact_link.contact_id = contact.id
        WHERE contact_link.user_id = youth.id AND contact_link.active = true
      ) AS contacts
    FROM users youth
    INNER JOIN youth_profiles profile ON profile.user_id = youth.id
    INNER JOIN user_roles role ON role.id = youth.role_id
    LEFT JOIN schools school ON school.id = profile.school_id
    LEFT JOIN user_credentials credentials ON credentials.user_id = youth.id
    WHERE role.name = 'youth' AND ${appliedFilters}
  `;
}
