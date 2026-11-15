import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursReferenceData } from '../../hours.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import useHoursData from './useHoursData';

vi.mock('../../hours.api', () => ({ getHoursReferenceData: vi.fn() }));
vi.mock('../../../../../common/features/referenceData/referenceData.api', () => ({ getCycleReferences: vi.fn(), getProgramReferences: vi.fn(), getStaffReferences: vi.fn() }));

describe('useHoursData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStaffReferences).mockResolvedValue([
      { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
      { id: 'staff-2', firstName: 'Alex', lastName: 'Morgan', name: 'Alex Morgan', role: 'staff', writable: false },
    ]);
    vi.mocked(getProgramReferences).mockResolvedValue([{ id: 'program-1', name: 'Soft Skills' }]);
    vi.mocked(getHoursReferenceData).mockResolvedValue({
      categories: [{ id: 'meeting', name: 'Meeting' }],
      types: [{ id: 'regular', name: 'Regular' }],
    });
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
  });

  it('loads each page-wide option once and resolves writable and current staff', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHoursData(['hours-options'], 'staff-1'),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.cycles).toHaveLength(1));
    expect(result.current.writableStaff.map(staffMember => staffMember.id)).toEqual(['staff-1']);
    expect(result.current.staffById.get('staff-2')?.name).toBe('Alex Morgan');
    expect(result.current.currentUserStaff?.name).toBe('Zoe Wilson');
    expect(getHoursReferenceData).toHaveBeenCalledOnce();
    expect(getStaffReferences).toHaveBeenCalledWith('hours', { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledOnce();
  });
});
