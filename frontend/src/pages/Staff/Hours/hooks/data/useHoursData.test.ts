import { getCycleReferences, getProgramReferences, getStaffReferences } from '../../../../../common/features/referenceData/referenceData.api';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getHoursReferenceData } from '../../hours.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import useHoursData, { getHoursSortValue } from './useHoursData';
import type { HoursItem, HoursSortKey } from '../../types';
import { makeHoursItem } from '../../../../../tests/factories/hours';

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
      categories: [{ value: 'meeting', label: 'Meeting' }],
      types: [{ value: 'regular', label: 'Regular' }],
    });
    vi.mocked(getCycleReferences).mockResolvedValue([{
      id: 'cycle-1', name: 'Summer 2026', startsOn: '2026-07-01', endsOn: '2026-09-01', state: 'active',
    }]);
  });

  it('loads each page-wide option once and exposes derived resource owners', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useHoursData(['hours-options'], 'staff-1'),
      { wrapper: createQueryClientWrapper(client) },
    );

    await waitFor(() => expect(result.current.cycles).toHaveLength(1));
    expect(result.current.writableResources.map(resource => resource.id)).toEqual(['staff-1']);
    expect(result.current.resourcesById.get('staff-2')?.name).toBe('Alex Morgan');
    expect(result.current.currentUserResource?.name).toBe('Zoe Wilson');
    expect(getHoursReferenceData).toHaveBeenCalledOnce();
    expect(getStaffReferences).toHaveBeenCalledWith('hours', { signal: expect.any(AbortSignal) });
    expect(getProgramReferences).toHaveBeenCalledWith({ assignedOnly: false }, { signal: expect.any(AbortSignal) });
    expect(getCycleReferences).toHaveBeenCalledOnce();
  });
});

const row = makeHoursItem({ date: '2026-10-01', firstName: 'Avery', lastName: 'Youth', name: 'Avery Youth' });

const sortValues: Array<[HoursSortKey, Partial<HoursItem>, string | number]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['date', { date: '2026-10-02' }, '2026-10-02'],
  ['program', { program: 'Other' }, 'other'],
  ['cycle', { cycle: 'Other' }, 'other'],
  ['category', { category: 'other' }, 'other'],
  ['hours', { hours: 10.5 }, 10.5],
  ['note', { note: 'Other' }, 'other'],
  ['type', { type: 'task' }, 'task'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getHoursSortValue({ ...row, ...changes }, key)).toEqual(expected);
});

it('sorts general time using the server’s empty program value', () => {
  expect(getHoursSortValue(makeHoursItem({ program: null }), 'program')).toBe('');
});
