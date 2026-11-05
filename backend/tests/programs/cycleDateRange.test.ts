import { asTransactionSql } from '../../src/db/client';
import { resolveCycleDateRange } from '../../src/services/programming/cycles/cycleDateRange';
import { sql } from '../shared/db';

const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const missingId = '33333333-3333-4333-8333-333333333333';

describe('cycle date range', () => {
  it('resolves selected and all-cycle spans without widening missing selections', async () => {
    await sql.begin(async transaction => {
      const database = asTransactionSql(transaction);
      // Shadow only this connection's cycles so empty-table behavior cannot affect shared fixtures.
      await database`CREATE TEMP TABLE program_cycles (id uuid PRIMARY KEY, starts_on date, ends_on date) ON COMMIT DROP`;
      expect(await resolveCycleDateRange(database, [])).toBeNull();
      expect(await resolveCycleDateRange(database, [missingId])).toBeNull();

      await database`
        INSERT INTO program_cycles (id, starts_on, ends_on) VALUES
          (${firstId}, '2081-01-01', '2081-01-31'),
          (${secondId}, '2081-03-01', '2081-03-31')
      `;

      expect(await resolveCycleDateRange(database, [firstId])).toEqual({ start: '2081-01-01', end: '2081-01-31' });
      expect(await resolveCycleDateRange(database, [secondId, firstId])).toEqual({ start: '2081-01-01', end: '2081-03-31' });
      expect(await resolveCycleDateRange(database, [])).toEqual({ start: '2081-01-01', end: '2081-03-31' });
      expect(await resolveCycleDateRange(database, [firstId, missingId])).toEqual({ start: '2081-01-01', end: '2081-01-31' });
      expect(await resolveCycleDateRange(database, [missingId])).toBeNull();
    });
  });
});
