import crypto from 'crypto';
import { deleteTestUser, seedTestUser, sql, type SeededUser, type SeedOverrides } from './db';
import type { AccessTokenPayload } from '../../src/types/auth';
import type { HoursCalendarQuery, SetHoursInput } from '../../src/validation/hoursSchemas';

export interface HoursTestUser extends SeededUser {
  auth: AccessTokenPayload;
}

export interface HoursFixture {
  admin: HoursTestUser;
  firstStaff: HoursTestUser;
  secondStaff: HoursTestUser;
  unrelatedStaff: HoursTestUser;
  programId: string;
  program: string;
  activeCycleId: string;
  upcomingCycleId: string;
  sessionId: string;
  date: string;
  linkedDate: string;
  placementDate: string;
  upcomingDate: string;
}

type RegularHoursInput = Extract<SetHoursInput, { source: 'regular' }>;

export const emptyHoursFilters: HoursCalendarQuery = {
  staffIds: [], categories: [], programIds: [], types: [], cycleIds: [], search: '',
};

/**
 * Seeds a real account and supplies its service identity without passing through HTTP.
 * @example await seedHoursUser({ role: 'staff' }) // active staff account and auth context
 */
export async function seedHoursUser(input: SeedOverrides): Promise<HoursTestUser> {
  const user = await seedTestUser(input);
  return {
    ...user,
    auth: {
      userId: user.userId, email: user.email, role: user.role,
      permissions: ['read:hours', 'write:hours', 'read:tasks', 'write:tasks'], tokenType: 'access',
      jti: crypto.randomUUID(), iat: 0, exp: 1,
    },
  };
}

/**
 * Creates suite-owned staff, a program, disjoint cycles and a linked session.
 * @example await createHoursFixture() // first and second staff share the program; unrelated staff does not
 */
export async function createHoursFixture(): Promise<HoursFixture> {
  const admin = await seedHoursUser({ role: 'admin' });
  const firstStaff = await seedHoursUser({ role: 'staff', firstName: 'Zoe', lastName: 'Wilson' });
  const secondStaff = await seedHoursUser({ role: 'staff', firstName: 'Alex', lastName: 'Morgan' });
  const unrelatedStaff = await seedHoursUser({ role: 'staff' });
  const [dates] = await sql<Array<{ date: string; linkedDate: string; placementDate: string; upcomingDate: string }>>`
    SELECT CURRENT_DATE AS date, CURRENT_DATE + 1 AS linked_date,
      CURRENT_DATE + 2 AS placement_date, CURRENT_DATE + 14 AS upcoming_date
  `;
  const [program] = await sql<Array<{ id: string; title: string }>>`
    INSERT INTO programs (title, enrollment_required)
    VALUES (${`Hours ${crypto.randomUUID()}`}, FALSE) RETURNING id, title
  `;
  const [activeCycle] = await sql<Array<{ id: string }>>`
    INSERT INTO program_cycles (title, starts_on, ends_on)
    VALUES (${`Active Hours ${crypto.randomUUID()}`}, ${dates.date}::date - 7, ${dates.date}::date + 7)
    RETURNING id
  `;
  const [upcomingCycle] = await sql<Array<{ id: string }>>`
    INSERT INTO program_cycles (title, starts_on, ends_on)
    VALUES (${`Upcoming Hours ${crypto.randomUUID()}`}, ${dates.upcomingDate}, ${dates.date}::date + 28)
    RETURNING id
  `;
  await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id)
    VALUES (${program.id}, ${activeCycle.id}), (${program.id}, ${upcomingCycle.id})`;
  await sql`INSERT INTO user_program_assignments (user_id, program_id)
    VALUES (${admin.userId}, ${program.id}), (${firstStaff.userId}, ${program.id}), (${secondStaff.userId}, ${program.id})`;
  const [session] = await sql<Array<{ id: string }>>`
    INSERT INTO program_sessions (program_id, cycle_id, session_type, title, date, start_time, end_time)
    VALUES (${program.id}, ${activeCycle.id}, 'Regular', 'Hours workshop', ${dates.date}, '10:00', '12:00')
    RETURNING id
  `;
  return {
    admin, firstStaff, secondStaff, unrelatedStaff, ...dates,
    programId: program.id, program: program.title, activeCycleId: activeCycle.id,
    upcomingCycleId: upcomingCycle.id, sessionId: session.id,
  };
}

/**
 * Removes each case's mutable entries, tasks and audits, preserving the read-only suite fixture.
 * @example await clearHoursRecords(fixture) // the next case starts without earlier logged time
 */
export async function clearHoursRecords(fixture: HoursFixture): Promise<void> {
  const ids = [fixture.admin.userId, fixture.firstStaff.userId, fixture.secondStaff.userId, fixture.unrelatedStaff.userId];
  await sql`DELETE FROM time_entries WHERE staff_id IN ${sql(ids)}`;
  await sql`DELETE FROM tasks WHERE created_by = ${fixture.admin.userId}`;
  await sql`DELETE FROM audit_log WHERE user_id IN ${sql(ids)}`;
}

/**
 * Removes suite-owned relationships after case records have been cleared.
 * @example await deleteHoursFixture(fixture) // leaves other suites' programs and users intact
 */
export async function deleteHoursFixture(fixture: HoursFixture): Promise<void> {
  await sql`DELETE FROM program_sessions WHERE id = ${fixture.sessionId}`;
  await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${fixture.programId}`;
  await sql`DELETE FROM program_cycles WHERE id IN (${fixture.activeCycleId}, ${fixture.upcomingCycleId})`;
  await sql`DELETE FROM programs WHERE id = ${fixture.programId}`;
  for (const user of [fixture.unrelatedStaff, fixture.secondStaff, fixture.firstStaff, fixture.admin]) {
    await deleteTestUser(user.userId);
  }
}

/**
 * Supplies a complete regular-entry fixture, with explicit scenario overrides.
 * @example regularHoursInput(fixture, { programId: null }) // general time with no program
 */
export function regularHoursInput(fixture: HoursFixture, overrides: Partial<RegularHoursInput> = {}): RegularHoursInput {
  return {
    source: 'regular', staffId: fixture.firstStaff.userId, programId: fixture.programId,
    category: 'meeting', date: fixture.date, hours: 1, note: 'Hours fixture', ...overrides,
  };
}

/**
 * Seeds a task for Hours integration without replaying task creation HTTP behavior.
 * @example await seedHoursTask(fixture, 'Poster') // open task assigned to the first staff member
 */
export async function seedHoursTask(fixture: HoursFixture, title: string): Promise<string> {
  const [task] = await sql<Array<{ id: string }>>`
    INSERT INTO tasks (title, category, program_id, staff_id, start_date, due_date, created_by, updated_by)
    VALUES (${title}, 'outreach', ${fixture.programId}, ${fixture.firstStaff.userId},
      ${fixture.date}, ${fixture.placementDate}, ${fixture.admin.userId}, ${fixture.admin.userId})
    RETURNING id
  `;
  return task.id;
}
