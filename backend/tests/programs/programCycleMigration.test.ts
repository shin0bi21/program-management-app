import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { asTransactionSql, sql } from '../../src/db/client';

it('migrates assignment history to program/cycle keys without losing identities or audit data', async () => {
  const rollback = new Error('rollback isolated program-cycle migration');
  const migration = readFileSync(join(process.cwd(), 'db/migrations/2026-11-03_1_replace_cohorts_with_program_cycles.sql'), 'utf8');
  const schema = `migration_${randomUUID().replaceAll('-', '')}`;
  const programId = randomUUID();
  const cycleId = randomUUID();
  const unassignedCycleId = randomUUID();
  const assignmentId = randomUUID();
  const sessionId = randomUUID();
  const enrollmentId = randomUUID();
  const hoursId = randomUUID();
  const actorId = randomUUID();

  await expect(sql.begin(async tx => {
    const trx = asTransactionSql(tx);
    // An isolated pre-migration schema exercises the actual forward SQL without changing the test database's schema.
    await trx`CREATE SCHEMA ${sql(schema)}`;
    await trx`SET LOCAL search_path TO ${sql(schema)}, public`;
    await trx.unsafe(`
      CREATE TABLE users (id UUID PRIMARY KEY);
      CREATE TABLE programs (id UUID PRIMARY KEY, timezone TEXT NOT NULL, enrollment_required BOOLEAN NOT NULL);
      CREATE TABLE program_cycles (id UUID PRIMARY KEY, starts_on DATE NOT NULL, ends_on DATE NOT NULL);
      CREATE TABLE program_cohorts (
        id UUID PRIMARY KEY, program_id UUID NOT NULL REFERENCES programs(id), cycle_id UUID NOT NULL REFERENCES program_cycles(id),
        LIKE public.base_table INCLUDING ALL, UNIQUE(program_id, cycle_id)
      );
      CREATE TABLE cohort_sessions (
        id UUID PRIMARY KEY, cohort_id UUID NOT NULL REFERENCES program_cohorts(id),
        theme TEXT, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL,
        LIKE public.base_table INCLUDING ALL
      );
      CREATE UNIQUE INDEX uq_cohort_sessions_cohort_theme_start ON cohort_sessions(cohort_id, theme, starts_at) NULLS NOT DISTINCT;
      CREATE TABLE cohort_enrollments (
        id UUID PRIMARY KEY, cohort_id UUID NOT NULL REFERENCES program_cohorts(id), youth_id UUID NOT NULL,
        enrolled_on DATE NOT NULL, withdrawn_on DATE, LIKE public.base_table INCLUDING ALL,
        UNIQUE(cohort_id, youth_id)
      );
      CREATE TABLE time_entries (
        id UUID PRIMARY KEY, program_id UUID NOT NULL, cycle_id UUID NOT NULL,
        session_id UUID REFERENCES cohort_sessions(id), hours NUMERIC NOT NULL,
        CONSTRAINT fk_time_entries_program_cycle FOREIGN KEY(program_id, cycle_id) REFERENCES program_cohorts(program_id, cycle_id)
      );
      CREATE FUNCTION enforce_session_within_cohort_dates() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
      CREATE FUNCTION enforce_cohort_cycle_contains_sessions() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
      CREATE FUNCTION enforce_cycle_dates_contain_sessions() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END; $$;
      CREATE TRIGGER cohort_sessions_within_cohort_dates BEFORE INSERT OR UPDATE OF cohort_id, starts_at, ends_at
        ON cohort_sessions FOR EACH ROW EXECUTE FUNCTION enforce_session_within_cohort_dates();
      CREATE TRIGGER program_cohort_cycle_contains_sessions BEFORE UPDATE OF cycle_id ON program_cohorts
        FOR EACH ROW EXECUTE FUNCTION enforce_cohort_cycle_contains_sessions();
      CREATE TRIGGER program_cycle_dates_contain_sessions BEFORE UPDATE OF starts_on, ends_on ON program_cycles
        FOR EACH ROW EXECUTE FUNCTION enforce_cycle_dates_contain_sessions();
    `);
    await trx`INSERT INTO users VALUES (${actorId})`;
    await trx`INSERT INTO programs VALUES (${programId}, 'America/Toronto', TRUE)`;
    await trx`INSERT INTO program_cycles VALUES (${cycleId}, '2026-01-01', '2026-12-31'),
      (${unassignedCycleId}, '2026-01-01', '2026-12-31')`;
    await trx`INSERT INTO program_cohorts (id, program_id, cycle_id, created_by, updated_by, created_at, updated_at)
      VALUES (${assignmentId}, ${programId}, ${cycleId}, ${actorId}, ${actorId}, '2025-12-01T00:00:00Z', '2026-01-01T00:00:00Z')`;
    await trx`INSERT INTO cohort_sessions (id, cohort_id, theme, starts_at, ends_at, created_by, updated_by)
      VALUES (${sessionId}, ${assignmentId}, 'Preserved session', '2026-06-01T17:00Z', '2026-06-01T19:00Z', ${actorId}, ${actorId})`;
    await trx`INSERT INTO cohort_enrollments (id, cohort_id, youth_id, enrolled_on, withdrawn_on, created_by, updated_by)
      VALUES (${enrollmentId}, ${assignmentId}, ${actorId}, '2026-02-01', '2026-05-01', ${actorId}, ${actorId})`;
    await trx`INSERT INTO time_entries VALUES (${hoursId}, ${programId}, ${cycleId}, ${sessionId}, 2)`;
    const [beforeSession] = await trx`SELECT * FROM cohort_sessions WHERE id = ${sessionId}`;
    const [beforeEnrollment] = await trx`SELECT * FROM cohort_enrollments WHERE id = ${enrollmentId}`;
    const [beforeAssignment] = await trx`SELECT * FROM program_cohorts WHERE id = ${assignmentId}`;

    await trx.unsafe(migration);

    const [afterSession] = await trx`SELECT * FROM program_sessions WHERE id = ${sessionId}`;
    const [afterEnrollment] = await trx`SELECT * FROM program_enrollments WHERE id = ${enrollmentId}`;
    const [afterAssignment] = await trx`SELECT * FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleId}`;
    const { cohortId: _sessionCohort, ...sessionFields } = beforeSession;
    const { cohortId: _enrollmentCohort, ...enrollmentFields } = beforeEnrollment;
    const { id: _assignmentId, ...assignmentFields } = beforeAssignment;
    expect(afterSession).toEqual({ ...sessionFields, programId, cycleId });
    expect(afterEnrollment).toEqual({ ...enrollmentFields, programId, cycleId });
    expect(afterAssignment).toEqual(assignmentFields);
    expect(await trx`SELECT * FROM time_entries WHERE id = ${hoursId}`).toEqual([{ id: hoursId, programId, cycleId, sessionId, hours: '2' }]);
    expect(await trx`SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} AND table_name = 'program_cohorts'`).toEqual([]);
    expect(await trx`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND column_name = 'cohort_id'`).toEqual([]);

    await expect(tx.savepoint(async savepoint => {
      const isolated = asTransactionSql(savepoint);
      await isolated`INSERT INTO program_sessions (id, program_id, cycle_id, theme, starts_at, ends_at)
        VALUES (${randomUUID()}, ${programId}, ${unassignedCycleId}, 'Invalid pair', '2026-06-01T17:00Z', '2026-06-01T19:00Z')`;
    })).rejects.toMatchObject({ code: '23503' });
    await expect(tx.savepoint(async savepoint => {
      const isolated = asTransactionSql(savepoint);
      await isolated`INSERT INTO program_enrollments (id, program_id, cycle_id, youth_id, enrolled_on)
        VALUES (${randomUUID()}, ${programId}, ${unassignedCycleId}, ${actorId}, '2026-02-01')`;
    })).rejects.toMatchObject({ code: '23503' });
    await expect(tx.savepoint(async savepoint => {
      const isolated = asTransactionSql(savepoint);
      await isolated`INSERT INTO time_entries (id, program_id, cycle_id, hours)
        VALUES (${randomUUID()}, ${programId}, ${unassignedCycleId}, 1)`;
    })).rejects.toMatchObject({ code: '23503' });
    await expect(tx.savepoint(async savepoint => {
      const isolated = asTransactionSql(savepoint);
      await isolated`DELETE FROM program_cycle_assignments WHERE program_id = ${programId} AND cycle_id = ${cycleId}`;
    })).rejects.toMatchObject({ code: '23001' });

    throw rollback;
  })).rejects.toBe(rollback);
});
