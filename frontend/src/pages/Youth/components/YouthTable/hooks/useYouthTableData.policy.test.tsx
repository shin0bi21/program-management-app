import { renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import useInfiniteListQuery from '../../../../../query/hooks/useInfiniteListQuery';
import type { YouthProfile, YouthSortKey } from '../../../types';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import useYouthTableData from './useYouthTableData';

vi.mock('../../../../../query/hooks/useInfiniteListQuery', () => ({ default: vi.fn(() => ({ rows: [] })) }));
beforeEach(() => {
  vi.clearAllMocks();
});

const row = makeYouthProfile({ activeProgram: { programId: 'program-1', program: 'Skills' } });

const sortValues: Array<[YouthSortKey, Partial<YouthProfile>, string]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['dateOfBirth', { dateOfBirth: '2012-01-01' }, '2012-01-01'],
  ['school', { schoolName: 'Other' }, 'other'],
  ['activeProgram', { activeProgram: { programId: 'program-1', program: 'Other' } }, 'other'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  renderHook(() => useYouthTableData({}, { key, direction: 'asc' }));
  const getValue = vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue;

  expect(getValue({ ...row, ...changes })).toEqual(expected);
});

it('normalizes nullable school and date values like the server', () => {
  const { rerender } = renderHook(({ key }: { key: YouthSortKey }) => useYouthTableData({}, { key, direction: 'asc' }), {
    initialProps: { key: 'school' as YouthSortKey },
  });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, schoolName: null })).toBe('');

  rerender({ key: 'activeProgram' });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, activeProgram: null })).toBe('');

  rerender({ key: 'dateOfBirth' });
  expect(vi.mocked(useInfiniteListQuery<YouthProfile>).mock.lastCall![0].ordering!.getValue({ ...row, dateOfBirth: null })).toBe('');
});
