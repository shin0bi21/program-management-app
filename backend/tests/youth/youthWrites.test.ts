import request from 'supertest';
import { createApp } from '../shared/app';
import { deleteTestUser, seedTestUser, sql } from '../shared/db';
import { generateToken } from '../shared/tokenHelpers';
import { deleteTestYouth } from './helpers';

const app = createApp();
const profile = { firstName: 'Required', lastName: 'Birthday', dateOfBirth: '2012-06-15' };

describe('Youth birth date writes and focused contacts', () => {
  let adminId: string;
  let adminToken: string;
  let youthId: string;
  let legacyId: string;
  let schoolId: string;
  let today: string;
  let tomorrow: string;
  let yesterday: string;
  const createdIds: string[] = [];

  /**
   * Sends a profile create or update request as the test administrator.
   * @param body - Request fields, including deliberately invalid fields in validation tests.
   * @example saveProfile(profile) // profile creation response
   */
  const saveProfile = (body: object) => request(app).post('/api/youth')
    .set('Authorization', `Bearer ${adminToken}`).send(body);
  /**
   * Sends a focused contact replacement request for one youth.
   * @param body - Replacement contact list or deliberately invalid request fields.
   * @param id - Youth ID to update; defaults to the legacy profile fixture.
   * @param token - Authentication token to use; defaults to the test administrator's token.
   * @example saveContacts({ contacts: [] }) // clears the legacy profile's contacts
   */
  const saveContacts = (body: object, id = legacyId, token = adminToken) => request(app)
    .put(`/api/youth/${id}/contacts`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    const admin = await seedTestUser({ role: 'admin' });
    adminId = admin.userId;
    adminToken = generateToken(adminId, 'admin');
    const response = await saveProfile(profile);
    expect(response.status).toBe(201);
    youthId = response.body.id;
    createdIds.push(youthId);

    const legacy = await seedTestUser({ role: 'youth' });
    legacyId = legacy.userId;
    createdIds.push(legacyId);
    await sql`INSERT INTO youth_profiles (user_id) VALUES (${legacyId})`;
    const [school] = await sql<{ id: string }[]>`
      INSERT INTO schools (name) VALUES (${`Focused contacts ${Date.now()}`}) RETURNING id
    `;
    schoolId = school.id;
    const [dates] = await sql<{ today: string; tomorrow: string; yesterday: string }[]>`
      SELECT (NOW() AT TIME ZONE 'America/Toronto')::date::text AS today,
        ((NOW() AT TIME ZONE 'America/Toronto')::date + 1)::text AS tomorrow,
        ((NOW() AT TIME ZONE 'America/Toronto')::date - 1)::text AS yesterday
    `;
    ({ today, tomorrow, yesterday } = dates);
  });

  afterAll(async () => {
    for (const id of createdIds) await deleteTestYouth(id);
    if (schoolId) await sql`DELETE FROM schools WHERE id = ${schoolId}`;
    await deleteTestUser(adminId);
  });

  it('rejects missing and non-youth update targets without creating or changing users', async () => {
    const missingId = '00000000-0000-4000-8000-000000000000';
    const [before] = await sql`SELECT first_name, last_name FROM users WHERE id = ${adminId}`;

    for (const id of [missingId, adminId]) {
      const response = await saveProfile({ ...profile, id });
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Youth profile not found');
    }

    expect(await sql`SELECT 1 FROM users WHERE id = ${missingId}`).toHaveLength(0);
    const [after] = await sql`SELECT first_name, last_name FROM users WHERE id = ${adminId}`;
    expect(after).toEqual(before);
    expect(await sql`SELECT 1 FROM youth_profiles WHERE user_id = ${adminId}`).toHaveLength(0);
  });

  describe.each(['create', 'edit'])('full profile %s', operation => {
    it.each(['', '15-06-2012', '2012-02-30', '0000-01-01'])('rejects an invalid supplied birth date %p', async dateOfBirth => {
      const response = await saveProfile({ ...profile, ...(operation === 'edit' ? { id: youthId } : {}), dateOfBirth });
      expect(response.status).toBe(400);
      if (operation === 'edit') {
        const [stored] = await sql<{ dateOfBirth: string }[]>`
          SELECT date_of_birth::text AS date_of_birth FROM youth_profiles WHERE user_id = ${youthId}
        `;
        expect(stored.dateOfBirth).toBe(profile.dateOfBirth);
      }
    });

    it('rejects today and future dates in Toronto', async () => {
      for (const dateOfBirth of [today, tomorrow]) {
        const response = await saveProfile({ ...profile, ...(operation === 'edit' ? { id: youthId } : {}), dateOfBirth });
        expect(response.status).toBe(400);
      }
    });

    it.each(['yesterday', '1980-01-01'])('accepts a real past date without age restrictions: %s', async value => {
      const dateOfBirth = value === 'yesterday' ? yesterday : value;
      const response = await saveProfile({ ...profile, ...(operation === 'edit' ? { id: youthId } : {}), dateOfBirth });
      expect(response.status).toBe(operation === 'create' ? 201 : 200);
      if (operation === 'create') createdIds.push(response.body.id);
      expect(response.body.dateOfBirth).toBe(dateOfBirth);
      if (operation === 'edit') {
        expect((await saveProfile({ ...profile, id: youthId })).status).toBe(200);
      }
    });
  });

  describe('temporarily optional backend birth dates', () => {
    it.each([undefined, null])('creates a profile with unknown DOB %p', async dateOfBirth => {
      const response = await saveProfile({ ...profile, dateOfBirth });
      expect(response.status).toBe(201);
      createdIds.push(response.body.id);
      expect(response.body.dateOfBirth).toBeNull();
      expect(response.body).not.toHaveProperty('age');
    });

    it('preserves known DOB when omitted and records explicit clearing in the audit', async () => {
      const omitted = await saveProfile({ id: youthId, firstName: profile.firstName, lastName: profile.lastName });
      expect(omitted.status).toBe(200);
      expect(omitted.body.dateOfBirth).toBe(profile.dateOfBirth);

      const cleared = await saveProfile({ ...profile, id: youthId, dateOfBirth: null });
      expect(cleared.status).toBe(200);
      expect(cleared.body.dateOfBirth).toBeNull();
      expect(cleared.body).not.toHaveProperty('age');

      const [audit] = await sql<{ oldDob: string; newDob: string | null }[]>`
        SELECT old_data->>'dateOfBirth' AS old_dob, new_data->>'dateOfBirth' AS new_dob
        FROM audit_log
        WHERE record_id = ${youthId} AND table_name = 'youth_profiles'
          AND action = 'UPDATE' AND old_data->>'dateOfBirth' IS NOT NULL
          AND new_data->>'dateOfBirth' IS NULL
        ORDER BY created_at DESC LIMIT 1
      `;
      expect(audit).toEqual({ oldDob: `${profile.dateOfBirth}T00:00:00.000Z`, newDob: null });
      expect((await saveProfile({ ...profile, id: youthId })).status).toBe(200);
    });

    it('edits a legacy profile without requiring an unknown DOB', async () => {
      const response = await saveProfile({ id: legacyId, firstName: 'Legacy', lastName: 'Updated' });
      expect(response.status).toBe(200);
      expect(response.body.dateOfBirth).toBeNull();
      expect(response.body.firstName).toBe('Legacy');
    });
  });

  it('rejects emergency as a relationship in both profile and focused contact writes', async () => {
    const contacts = [{ phoneNumber: '4165550100', type: 'emergency' }];

    expect((await saveProfile({ ...profile, contacts })).status).toBe(400);
    expect((await saveContacts({ contacts })).status).toBe(400);
  });

  describe('PUT /api/youth/:id/contacts', () => {
    it('requires authentication and the explicit write capability', async () => {
      const unauthenticated = await request(app).put(`/api/youth/${legacyId}/contacts`).send({ contacts: [] });
      expect(unauthenticated.status).toBe(401);
      const readOnlyToken = generateToken(adminId, 'admin', undefined, ['read:youth_profiles']);
      expect((await saveContacts({ contacts: [] }, legacyId, readOnlyToken)).status).toBe(403);
    });

    it('validates the youth identifier and reports missing profiles', async () => {
      expect((await saveContacts({ contacts: [] }, 'invalid')).status).toBe(400);
      expect((await saveContacts({ contacts: [] }, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    });

    it.each([
      {},
      { contacts: null },
      { contacts: [{ phoneNumber: '' }] },
      { contacts: [{ phoneNumber: '4165550100', type: 'other' }] },
      { contacts: [{ id: 'invalid', phoneNumber: '4165550100' }] },
      { contacts: [], dateOfBirth: '2012-06-15' },
    ])('rejects invalid or unrelated contact command data %p', async body => {
      expect((await saveContacts(body)).status).toBe(400);
    });

    it('updates and clears contacts on a legacy profile without clearing or requiring its birth date', async () => {
      const saved = await saveContacts({ contacts: [{ phoneNumber: ' 4165550100 ', type: 'guardian' }] });
      expect(saved.status).toBe(200);
      expect(saved.body).toEqual(expect.objectContaining({
        id: legacyId,
        dateOfBirth: null,
        contacts: [expect.objectContaining({ phoneNumber: '4165550100', type: 'guardian' })],
      }));

      const contactId = saved.body.contacts[0].id;
      const updated = await saveContacts({ contacts: [{ id: contactId.toUpperCase(), phoneNumber: '4165550101', type: 'sibling' }] });
      expect(updated.status).toBe(200);
      expect(updated.body.contacts).toEqual([
        expect.objectContaining({ id: contactId, phoneNumber: '4165550101', type: 'sibling' }),
      ]);
      const cleared = await saveContacts({ contacts: [] });
      expect(cleared.status).toBe(200);
      expect(cleared.body.contacts).toBeNull();
      expect(cleared.body.dateOfBirth).toBeNull();

      const [audit] = await sql<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM audit_log
        WHERE record_id = ${contactId} AND user_id = ${adminId}
      `;
      expect(audit.count).toBeGreaterThan(0);
    });

    it.each(['foreign', 'inactive', 'nonexistent', 'duplicate'] as const)('rejects %s contact IDs without changing profiles, contacts, or audits', async invalidKind => {
      const target = await saveProfile({
        ...profile,
        contacts: [
          { phoneNumber: '4165550300', type: 'parent' },
          { phoneNumber: '4165550301', type: 'guardian' },
          { phoneNumber: '4165550302', type: 'sibling' },
        ],
      });
      expect(target.status).toBe(201);
      createdIds.push(target.body.id);

      const foreign = await saveProfile({
        ...profile,
        contacts: [{ phoneNumber: '4165550303', type: 'parent' }],
      });
      expect(foreign.status).toBe(201);
      createdIds.push(foreign.body.id);

      /**
       * Finds a contact ID in the successfully created target profile.
       * @param phoneNumber - Phone number of a contact included in the creation request.
       * @example contactIdFor('4165550300') // ID of the first saved contact
       */
      const contactIdFor = (phoneNumber: string) => target.body.contacts.find(
        (contact: { phoneNumber: string }) => contact.phoneNumber === phoneNumber,
      ).id as string;
      const retainedId = contactIdFor('4165550300');
      const omittedId = contactIdFor('4165550301');
      const inactiveId = contactIdFor('4165550302');
      const prepared = await saveContacts({ contacts: [
        { id: retainedId, phoneNumber: '4165550300', type: 'parent' },
        { id: omittedId, phoneNumber: '4165550301', type: 'guardian' },
      ] }, target.body.id);
      expect(prepared.status).toBe(200);
      expect(prepared.body.contacts.map((contact: { id: string }) => contact.id).sort())
        .toEqual([retainedId, omittedId].sort());

      const ids = [target.body.id, foreign.body.id];
      const newPhoneNumber = '4165550399';
      /**
       * Captures both profiles, their contacts, and the administrator's audit records.
       * @example captureSavedState() // state to compare before and after a rejected request
       */
      const captureSavedState = async () => ({
        profiles: await sql`
          SELECT youth.*, to_jsonb(profile) AS profile
          FROM users youth
          INNER JOIN youth_profiles profile ON profile.user_id = youth.id
          WHERE youth.id = ANY(${sql.array(ids)}::uuid[])
          ORDER BY youth.id
        `,
        links: await sql`
          SELECT * FROM user_has_contacts
          WHERE user_id = ANY(${sql.array(ids)}::uuid[]) ORDER BY user_id, contact_id
        `,
        contacts: await sql`
          SELECT * FROM contacts WHERE id IN (
            SELECT contact_id FROM user_has_contacts WHERE user_id = ANY(${sql.array(ids)}::uuid[])
          ) OR phone_number = ${newPhoneNumber} ORDER BY id
        `,
        audits: await sql`SELECT * FROM audit_log WHERE user_id = ${adminId} ORDER BY id`,
      });
      const before = await captureSavedState();
      const invalidId = ({
        foreign: foreign.body.contacts[0].id,
        inactive: inactiveId,
        nonexistent: '00000000-0000-4000-8000-000000000000',
        duplicate: retainedId.toUpperCase(),
      })[invalidKind];

      const response = await saveContacts({ contacts: [
        { phoneNumber: newPhoneNumber, type: 'parent' },
        { id: retainedId, phoneNumber: '4165550310', type: 'guardian' },
        { id: invalidId, phoneNumber: '4165550311', type: 'sibling' },
      ] }, target.body.id);

      expect(response.status).toBe(invalidKind === 'duplicate' ? 400 : 404);
      if (invalidKind === 'duplicate') {
        expect(response.body.details).toEqual(expect.arrayContaining([
          expect.objectContaining({ field: 'body.contacts' }),
        ]));
      } else {
        expect(response.body.error).toBe('One or more youth contacts were not found');
      }
      expect(await captureSavedState()).toEqual(before);
    });

    it('preserves authoritative profile fields changed before a focused contact save', async () => {
      const authoritative = await saveProfile({
        ...profile, id: youthId, firstName: 'Authoritative', lastName: 'Changed',
        dateOfBirth: '2000-01-01', schoolId,
        addresses: [{ address: '123 Current Street' }],
      });
      expect(authoritative.status).toBe(200);

      const focused = await saveContacts({ contacts: [{ phoneNumber: '4165550200', type: 'parent' }] }, youthId);
      expect(focused.status).toBe(200);
      for (const field of ['firstName', 'lastName', 'dateOfBirth', 'schoolId', 'schoolName', 'addresses']) {
        expect(focused.body[field]).toEqual(authoritative.body[field]);
      }
      expect(focused.body.contacts).toEqual([expect.objectContaining({ phoneNumber: '4165550200' })]);
      const reread = await request(app).get(`/api/youth?id=${youthId}`).set('Authorization', `Bearer ${adminToken}`);
      expect(reread.body).toEqual(focused.body);
    });
  });
});
