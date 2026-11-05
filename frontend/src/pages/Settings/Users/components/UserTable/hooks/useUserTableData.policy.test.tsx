import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { User, UserSortKey } from '../../../types';
import useUserTableData from './useUserTableData';

vi.mock('../../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => vi.clearAllMocks());

const row: User = {
  id: 'account-1', firstName: 'Avery', lastName: 'Youth', email: 'avery@example.com',
  role: 'staff', status: 'active', createdAt: '2026-01-01', programIds: [],
};

const sortValues: Array<[UserSortKey, Partial<User>, string | Date]> = [
  ['name', { firstName: 'Other' }, 'other youth'],
  ['email', { email: 'Other@example.com' }, 'other@example.com'],
  ['role', { role: 'admin' }, 'admin'],
  ['status', { status: 'inactive' }, 'inactive'],
  ['createdAt', { createdAt: '2027-01-01' }, new Date('2027-01-01')],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  renderHook(() => useUserTableData(['accounts', 'table'], {}, { key, direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<User>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});

it('compares timestamp instants independently of their serialized offset', () => {
  renderHook(() => useUserTableData(['accounts', 'table'], {}, { key: 'createdAt', direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<User>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, createdAt: '2026-10-01T08:00:00-04:00' })).toEqual(new Date('2026-10-01T12:00:00Z'));
});
