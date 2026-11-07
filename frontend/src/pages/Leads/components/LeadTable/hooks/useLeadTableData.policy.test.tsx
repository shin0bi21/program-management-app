import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { Lead, LeadSortKey } from '../../../types';
import { useLeadTableData } from './useLeadTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: Lead = {
  id: 'lead-1', origin: 'internal', submittedByRole: 'staff', convertedYouthId: null,
  youthFirstName: 'Avery', youthLastName: 'Youth', dateOfBirth: null, age: null, school: 'Central',
  recommendedProgramId: 'program-1', recommendedProgram: 'Skills', contactPhoneNumber: '4165550100',
  contactRelationship: 'guardian', discoverySource: 'school', notes: null, status: 'new',
  statusUpdatedAt: '2026-01-01', createdAt: '2026-01-01',
};

const sortValues: Array<[LeadSortKey, Partial<Lead>, string | Date]> = [
  ['firstName', { youthFirstName: 'Other' }, 'other'],
  ['lastName', { youthLastName: 'Other' }, 'other'],
  ['school', { school: 'Other' }, 'other'],
  ['program', { recommendedProgram: 'Other' }, 'other'],
  ['status', { status: 'closed' }, 'closed'],
  ['created', { createdAt: '2027-01-01' }, new Date('2027-01-01')],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  renderHook(() => useLeadTableData(['leads', 'table'], {}, { key, direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<Lead>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useLeadTableData(['leads', 'table'], {}, { key: 'created', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<Lead>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, createdAt: '2026-10-01T08:00:00-04:00' })).toEqual(new Date('2026-10-01T12:00:00Z'));
});
