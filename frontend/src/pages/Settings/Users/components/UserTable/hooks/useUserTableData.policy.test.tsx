import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { User, UserFilters, UserSortKey } from '../../../types';
import useUserTableData from './useUserTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: User = {
  id: 'account-1', firstName: 'Avery', lastName: 'Youth', email: 'avery@example.com',
  role: 'staff', status: 'active', createdAt: '2026-01-01', programIds: [],
};

const sortChanges: Array<[UserSortKey, Partial<User>]> = [
  ['name', { firstName: 'Other' }],
  ['email', { email: 'other@example.com' }],
  ['role', { role: 'admin' }],
  ['status', { status: 'inactive' }],
  ['createdAt', { createdAt: '2027-01-01' }],
];

it.each(sortChanges)('maps %s to its canonical sort value and ignores unrelated edits', (key, changes) => {
  const filters: UserFilters = {};
  renderHook(() => useUserTableData(['accounts', 'table'], filters, { key, direction: 'asc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('asc');
  const getValue = vi.mocked(useInfiniteListQuery<User>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).not.toEqual(getValue(row));
  expect(getValue({ ...row, programIds: ['program-1'] })).toEqual(getValue(row));
});

it('ignores active filter and search changes outside the sort column', () => {
  const filters: UserFilters = { roles: ['staff'], statuses: ['active'], search: 'avery' };
  const key: UserSortKey = sortChanges[0][0];
  renderHook(() => useUserTableData(['accounts', 'table'], filters, { key, direction: 'desc' }));
  expect(vi.mocked(useInfiniteListQuery).mock.calls[0][0].ordering?.direction).toBe('desc');
  const getValue = vi.mocked(useInfiniteListQuery<User>).mock.calls[0][0].ordering!.getValue;
  const changedRows: User[] = [{ ...row, role: 'admin' }, { ...row, status: 'inactive' }, { ...row, email: 'other@example.com' }];

  for (const changed of changedRows) expect(getValue(changed)).toEqual(getValue(row));
  expect(getValue({ ...row, programIds: ['program-1'] })).toEqual(getValue(row));
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useUserTableData(['accounts', 'table'], {}, { key: 'createdAt', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<User>).mock.calls[0][0].ordering!.getValue;

  expect(getValue({ ...row, createdAt: '2026-10-01T12:00:00Z' })).toEqual(getValue({ ...row, createdAt: '2026-10-01T08:00:00-04:00' }));
});
