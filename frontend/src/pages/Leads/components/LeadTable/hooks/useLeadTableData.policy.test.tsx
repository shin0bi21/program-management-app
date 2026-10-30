import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { Lead, LeadFilters, LeadSortKey } from '../../../types';
import { useLeadTableData } from './useLeadTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: Lead = {
  id: 'lead-1', origin: 'internal', submittedByRole: 'staff', convertedYouthId: null,
  youthFirstName: 'Avery', youthLastName: 'Youth', dateOfBirth: null, age: null, school: 'Central',
  recommendedProgramId: 'program-1', recommendedProgramName: 'Skills', contactPhoneNumber: '4165550100',
  contactRelationship: 'guardian', discoverySource: 'school', notes: null, status: 'new',
  statusUpdatedAt: '2026-01-01', createdAt: '2026-01-01',
};

const sortChanges: Array<[LeadSortKey, Partial<Lead>]> = [
  ['firstName', { youthFirstName: 'Other' }],
  ['lastName', { youthLastName: 'Other' }],
  ['school', { school: 'Other' }],
  ['program', { recommendedProgramName: 'Other' }],
  ['status', { status: 'closed' }],
  ['created', { createdAt: '2027-01-01' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: LeadFilters = {};
  renderHook(() => useLeadTableData(['leads', 'table'], filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<Lead>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, notes: 'Unrelated details' })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: LeadFilters = { statuses: ['new'], programIds: ['program-1'], origins: ['internal'], submitterRoles: ['staff'], search: 'avery' };
  const key: LeadSortKey = sortChanges[0][0];
  renderHook(() => useLeadTableData(['leads', 'table'], filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<Lead>).mock.calls[0][0].ordering!.getValue;
  const changedRows: Lead[] = [{ ...row, status: 'closed' }, { ...row, recommendedProgramId: 'other' }, { ...row, origin: 'external' }, { ...row, submittedByRole: 'youth' }, { ...row, school: 'Other' }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, notes: 'Unrelated details' })).toEqual(getValue(row));
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useLeadTableData(['leads', 'table'], {}, { key: 'created', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<Lead>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, createdAt: '2026-10-01T12:00:00Z' })).toEqual(getValue({ ...row, createdAt: '2026-10-01T08:00:00-04:00' }));
});
