import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getProgramCycles } from '../../../../Programming/Cohorts/cohorts.api';
import { getHoursReferenceData } from '../../hours.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import useHoursData from './useHoursData';

vi.mock('../../../../Programming/Cohorts/cohorts.api', () => ({ getProgramCycles: vi.fn() }));
vi.mock('../../hours.api', () => ({ getHoursReferenceData: vi.fn() }));

describe('useHoursData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      resources: [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
      ],
      programs: [{ id: 'program-1', name: 'Soft Skills' }],
      categories: [{ value: 'meeting', label: 'Meeting' }],
      types: [{ value: 'other', label: 'Regular' }],
    });
    vi.mocked(getProgramCycles).mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
  });

  it('loads each page-wide option once and exposes derived resource owners', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHoursData(['hours-options'], ['program-cycles'], 'staff-1'),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.cycles).toHaveLength(1));
    expect(result.current.writableResources.map(resource => resource.id)).toEqual(['staff-1']);
    expect(result.current.resourcesById.get('staff-2')?.name).toBe('Alex Morgan');
    expect(result.current.currentUserResource?.name).toBe('Zoe Wilson');
    expect(getHoursReferenceData).toHaveBeenCalledOnce();
    expect(getProgramCycles).toHaveBeenCalledOnce();
  });
});
