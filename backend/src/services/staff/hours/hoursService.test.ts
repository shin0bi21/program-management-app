import { sql } from '../../../db/client';
import type { AccessTokenPayload } from '../../../types/auth';
import { ForbiddenError, NotFoundError } from '../../../errors';
import { deleteTestUser } from '../../../../tests/shared/db';
import {
  createHoursFixture, clearHoursRecords, deleteHoursFixture, emptyHoursFilters,
  regularHoursInput, seedHoursTask, seedHoursUser, type HoursFixture,
} from '../../../../tests/shared/hoursFixtures';
import { getTask, deleteTask, updateTaskState } from '../tasks/taskService';
import { getHoursRows } from './hoursRowQuery';
import { deleteHours, getHoursCalendarData, getHoursSessions, setHours, updateHoursPlacement } from './hoursService';

describe('Hours service', () => {
  let fixture: HoursFixture;
  beforeAll(async () => { fixture = await createHoursFixture(); });
  afterEach(async () => { await clearHoursRecords(fixture); });
  afterAll(async () => { await deleteHoursFixture(fixture); });

  describe('Write access', () => {
    it('rejects writes, moves and deletes for another staff member', async () => {
      const { firstStaff, secondStaff, unrelatedStaff, admin, placementDate } = fixture;
      await expect(setHours(regularHoursInput(fixture, { staffId: secondStaff.userId }), firstStaff.auth))
        .rejects.toBeInstanceOf(ForbiddenError);
      for (const staff of [secondStaff, unrelatedStaff]) {
        const entry = await setHours(regularHoursInput(fixture, { staffId: staff.userId }), admin.auth);
        await expect(updateHoursPlacement(entry.id, { date: placementDate }, firstStaff.auth)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(deleteHours(entry.id, firstStaff.auth)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(setHours(regularHoursInput(fixture, { staffId: staff.userId, hours: 2 }), firstStaff.auth, entry.id))
          .rejects.toBeInstanceOf(ForbiddenError);
      }
    });

    it('lets project managers write their own hours and read shared staff without coworker writes', async () => {
      const manager = await seedHoursUser({ role: 'project_manager' });
      try {
        await sql`INSERT INTO user_program_assignments (user_id, program_id) VALUES (${manager.userId}, ${fixture.programId})`;
        const own = await setHours(regularHoursInput(fixture, { staffId: manager.userId }), manager.auth);
        expect(own.staffId).toBe(manager.userId);
        await expect(setHours(regularHoursInput(fixture), manager.auth)).rejects.toBeInstanceOf(ForbiddenError);
        const shared = await setHours(regularHoursInput(fixture), fixture.admin.auth);
        expect(await getHoursCalendarData(manager.auth, { ...emptyHoursFilters, staffIds: [fixture.firstStaff.userId] }))
          .toEqual([expect.objectContaining({ id: shared.id })]);
        await expect(deleteHours(shared.id, manager.auth)).rejects.toBeInstanceOf(ForbiddenError);
      } finally {
        await sql`DELETE FROM time_entries WHERE staff_id = ${manager.userId}`;
        await sql`DELETE FROM audit_log WHERE user_id = ${manager.userId}`;
        await deleteTestUser(manager.userId);
      }
    });
  });

  describe('Regular entries and placement', () => {
    it('creates a canonical own entry that agrees with subsequent reads', async () => {
      const { firstStaff, programId, program } = fixture;
      const entry = await setHours(regularHoursInput(fixture, { hours: 2.5, note: 'Program meeting' }), firstStaff.auth);
      expect(entry).toEqual(expect.objectContaining({
        staffId: firstStaff.userId, firstName: 'Zoe', lastName: 'Wilson', programId, program,
        category: 'meeting', type: 'regular', taskId: null, sessionId: null, hours: 2.5, note: 'Program meeting',
      }));
      expect(entry).not.toHaveProperty('name');
      expect(entry).not.toHaveProperty('staffName');
      const { updatedTasks: _updatedTasks, ...saved } = entry;
      expect(await getHoursCalendarData(firstStaff.auth, emptyHoursFilters)).toEqual([saved]);
    });

    it('derives a cycle for general time without a program', async () => {
      const entry = await setHours(regularHoursInput(fixture, { programId: null, category: 'planning_prep' }), fixture.firstStaff.auth);
      expect(entry).toEqual(expect.objectContaining({ programId: null, cycleId: fixture.activeCycleId }));
    });

    it('updates and deletes an own entry', async () => {
      const { firstStaff } = fixture;
      const created = await setHours(regularHoursInput(fixture), firstStaff.auth);
      const updated = await setHours(regularHoursInput(fixture, {
        programId: null, category: 'planning_prep', hours: 1.5, note: 'Updated note',
      }), firstStaff.auth, created.id);
      expect(updated).toEqual(expect.objectContaining({ programId: null, category: 'planning_prep', hours: 1.5, note: 'Updated note' }));
      await deleteHours(created.id, firstStaff.auth);
      expect(await getHoursRows(firstStaff.auth)).toEqual([]);
    });

    it('moves the stored cycle atomically when placement crosses a cycle boundary', async () => {
      const { firstStaff, activeCycleId, upcomingCycleId, upcomingDate } = fixture;
      const created = await setHours(regularHoursInput(fixture), firstStaff.auth);
      expect(created.cycleId).toBe(activeCycleId);
      const moved = await updateHoursPlacement(created.id, { date: upcomingDate }, firstStaff.auth);
      expect(moved).toEqual(expect.objectContaining({ date: upcomingDate, cycleId: upcomingCycleId }));
    });

    it('preserves newer content when calendar placement changes', async () => {
      const { firstStaff, activeCycleId, placementDate } = fixture;
      const created = await setHours(regularHoursInput(fixture, { note: 'Original note' }), firstStaff.auth);
      await setHours(regularHoursInput(fixture, {
        programId: null, category: 'planning_prep', hours: 2.5, note: 'Newer saved note',
      }), firstStaff.auth, created.id);
      const moved = await updateHoursPlacement(created.id, { date: placementDate }, firstStaff.auth);
      expect(moved).toEqual(expect.objectContaining({
        staffId: firstStaff.userId, programId: null, cycleId: activeCycleId, category: 'planning_prep',
        date: placementDate, hours: 2.5, note: 'Newer saved note',
      }));
      const { updatedTasks: _updatedTasks, ...saved } = moved;
      expect(await getHoursRows(firstStaff.auth)).toEqual([saved]);
    });

    it('rejects work dates without a covering cycle', async () => {
      await expect(setHours(regularHoursInput(fixture, { programId: null, date: '2025-01-15' }), fixture.firstStaff.auth))
        .rejects.toMatchObject({ status: 409, message: 'No cycle covers the selected work date' });
    });

    it('rejects dates with multiple eligible cycles', async () => {
      const { date, programId } = fixture;
      const [overlap] = await sql<Array<{ id: string }>>`INSERT INTO program_cycles (title, starts_on, ends_on)
        VALUES ('Overlapping write cycle', ${date}, ${date}) RETURNING id`;
      await sql`INSERT INTO program_cycle_assignments (program_id, cycle_id) VALUES (${programId}, ${overlap.id})`;
      try {
        await expect(setHours(regularHoursInput(fixture), fixture.firstStaff.auth))
          .rejects.toMatchObject({ status: 409, message: 'Multiple cycles cover the selected work date' });
      } finally {
        await sql`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${overlap.id}`;
        await sql`DELETE FROM program_cycles WHERE id = ${overlap.id}`;
      }
    });
  });

  describe('Session-linked entries', () => {
    it('lists assigned sessions and derives their write scope for staff and administrators', async () => {
      const { firstStaff, unrelatedStaff, admin, date, sessionId, activeCycleId, programId } = fixture;
      expect(await getHoursSessions(firstStaff.auth, { staffId: firstStaff.userId, date }))
        .toEqual([{ id: sessionId, name: 'Hours workshop', date }]);
      expect(await getHoursSessions(unrelatedStaff.auth, { staffId: unrelatedStaff.userId, date })).toEqual([]);
      await expect(setHours({ source: 'session', staffId: unrelatedStaff.userId, sessionId, hours: 1, note: 'Unassigned' }, unrelatedStaff.auth))
        .rejects.toBeInstanceOf(NotFoundError);
      for (const staff of [firstStaff, admin]) {
        const entry = await setHours({ source: 'session', staffId: staff.userId, sessionId, hours: 2, note: 'Workshop' }, staff.auth);
        expect(entry).toEqual(expect.objectContaining({
          staffId: staff.userId, sessionId, type: 'session', category: 'program_delivery', programId, cycleId: activeCycleId, date,
        }));
      }
      expect(await getHoursSessions(admin.auth, { staffId: admin.userId, date }))
        .toEqual([{ id: sessionId, name: 'Hours workshop', date }]);
    });
  });

  describe('Task-linked entries', () => {
    it('derives assigned task scope and preserves lifecycle and deletion protections', async () => {
      const { firstStaff, secondStaff, admin, linkedDate, date, programId } = fixture;
      const taskId = await seedHoursTask(fixture, 'Create marketing poster');
      const input = { source: 'task' as const, staffId: firstStaff.userId, taskId, date: linkedDate, hours: 2, note: 'Drafted poster', completeTask: false };
      await expect(setHours({ ...input, staffId: secondStaff.userId }, secondStaff.auth)).rejects.toBeInstanceOf(NotFoundError);
      const entry = await setHours(input, firstStaff.auth);
      expect(entry).toEqual(expect.objectContaining({ taskId, type: 'task', taskTitle: 'Create marketing poster', category: 'outreach', programId }));
      expect(await getTask(taskId, firstStaff.auth)).toEqual(expect.objectContaining({
        state: 'open', hoursLogged: 2, loggedHoursByDate: [{ date: linkedDate, hours: 2 }],
      }));
      await updateTaskState(taskId, 'completed', firstStaff.auth);
      await expect(setHours({ ...input, date }, firstStaff.auth)).rejects.toBeInstanceOf(NotFoundError);
      await updateTaskState(taskId, 'open', firstStaff.auth);
      await updateTaskState(taskId, 'cancelled', firstStaff.auth);
      await expect(setHours({ ...input, date }, firstStaff.auth)).rejects.toBeInstanceOf(NotFoundError);
      await expect(deleteTask(taskId, admin.auth)).rejects.toMatchObject({ status: 409, message: 'Tasks with logged time cannot be deleted' });
      expect(await getHoursCalendarData(firstStaff.auth, { ...emptyHoursFilters, start: linkedDate, end: linkedDate }))
        .toEqual([expect.objectContaining({ id: entry.id, taskId, taskTitle: 'Create marketing poster' })]);
    });

    it('completes an open task atomically while logging time', async () => {
      const { firstStaff, date } = fixture;
      const taskId = await seedHoursTask(fixture, 'Complete with time');
      const entry = await setHours({ source: 'task', staffId: firstStaff.userId, taskId, completeTask: true, date, hours: 1, note: 'Finished' }, firstStaff.auth);
      const task = await getTask(taskId, firstStaff.auth);
      expect(task).toEqual(expect.objectContaining({ status: 'completed', hoursLogged: 1 }));
      expect(entry.updatedTasks).toEqual([task]);
    });

    it('returns canonical records and every affected task after moves, reassignment and deletion', async () => {
      const { firstStaff, date, placementDate } = fixture;
      const firstTask = await seedHoursTask(fixture, 'First hours task');
      const secondTask = await seedHoursTask(fixture, 'Second hours task');
      const input = { source: 'task' as const, staffId: firstStaff.userId, date, hours: 2, note: 'Canonical hours', completeTask: false };
      const created = await setHours({ ...input, taskId: firstTask }, firstStaff.auth);
      const { updatedTasks: createdTasks, ...createdEntry } = created;
      expect(await getHoursRows(firstStaff.auth)).toEqual([createdEntry]);
      expect(createdTasks).toEqual([await getTask(firstTask, firstStaff.auth)]);

      const moved = await updateHoursPlacement(created.id, { date: placementDate }, firstStaff.auth);
      const { updatedTasks: movedTasks, ...movedEntry } = moved;
      expect(await getHoursRows(firstStaff.auth)).toEqual([movedEntry]);
      expect(await getHoursCalendarData(firstStaff.auth, emptyHoursFilters)).toEqual([movedEntry]);
      expect(movedTasks).toEqual([await getTask(firstTask, firstStaff.auth)]);
      expect(movedTasks?.[0].loggedHoursByDate).toEqual([{ date: placementDate, hours: 2 }]);

      const updated = await setHours({ ...input, taskId: secondTask, hours: 3 }, firstStaff.auth, created.id);
      const { updatedTasks, ...updatedEntry } = updated;
      expect(await getHoursRows(firstStaff.auth)).toEqual([updatedEntry]);
      expect(updatedTasks).toEqual([await getTask(firstTask, firstStaff.auth), await getTask(secondTask, firstStaff.auth)]);
      expect(updatedTasks?.map(task => task.hoursLogged)).toEqual([0, 3]);
      const deleted = await deleteHours(created.id, firstStaff.auth);
      expect(deleted.updatedTasks).toEqual([await getTask(secondTask, firstStaff.auth)]);
      expect(deleted.updatedTasks?.[0].hoursLogged).toBe(0);
    });

    it('rolls back completion without task-write permission while permitting hours-only writes', async () => {
      const { firstStaff, date } = fixture;
      const taskId = await seedHoursTask(fixture, 'Protected completion');
      const user: AccessTokenPayload = { ...firstStaff.auth, permissions: ['write:hours'] };
      const input = { source: 'task' as const, staffId: firstStaff.userId, taskId, date, hours: 1, note: 'Protected time', completeTask: true };
      await expect(setHours(input, user)).rejects.toBeInstanceOf(ForbiddenError);
      expect((await getTask(taskId, firstStaff.auth)).state).toBe('open');
      expect(await sql`SELECT id FROM time_entries WHERE task_id = ${taskId}`).toHaveLength(0);
      expect(await sql`SELECT id FROM audit_log WHERE user_id = ${firstStaff.userId}`).toHaveLength(0);
      const saved = await setHours({ ...input, completeTask: false }, user);
      expect(saved).not.toHaveProperty('updatedTasks');
    });
  });
});
