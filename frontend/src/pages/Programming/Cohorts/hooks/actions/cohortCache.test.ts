// @vitest-environment node
import { expect, it } from 'vitest';
import { createTestQueryClient } from '../../../../../tests/queryClientTestUtils';
import type { ProgramCohort } from '../../types';
import { COHORT_TABLE_QUERY_KEY, syncCohortChanges } from './cohortCache';

it('reconciles updated and removed cohort rows without reordering or refetching existing collections', () => {
  const client = createTestQueryClient();
  const old = { id: 'edited', name: 'Alpha' } as ProgramCohort;
  const other = { id: 'other', name: 'Beta' } as ProgramCohort;
  const removed = { id: 'removed', name: 'Gamma' } as ProgramCohort;
  const key = [...COHORT_TABLE_QUERY_KEY, { search: '' }];
  client.setQueryData(key, { pages: [{ rows: [old, other, removed], nextCursor: null }], pageParams: [null] });
  const saved = { ...old, name: 'Zulu' };

  syncCohortChanges(client, { updatedCohorts: [saved], removedCohortIds: [removed.id], createdCohortIds: [] });

  const data = client.getQueryData<{ pages: { rows: ProgramCohort[] }[] }>(key);
  expect(data?.pages[0].rows).toEqual([saved, other]);
  expect(data?.pages[0].rows[1]).toBe(other);
  expect(client.getQueryState(key)?.isInvalidated).toBe(false);

  syncCohortChanges(client, { updatedCohorts: [], removedCohortIds: [], createdCohortIds: ['created'] });
  expect(client.getQueryState(key)?.isInvalidated).toBe(true);
});
