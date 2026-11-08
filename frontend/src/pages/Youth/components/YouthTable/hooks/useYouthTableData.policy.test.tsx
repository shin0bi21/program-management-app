// @vitest-environment node
import { expect, it } from 'vitest';
import type { YouthProfile, YouthSortKey } from '../../../types';
import { makeYouthProfile } from '../../../../../tests/factories/youth';
import { getYouthSortValue } from './useYouthTableData';

const row = makeYouthProfile({ activeProgram: { programId: 'program-1', program: 'Skills' } });

const sortValues: Array<[YouthSortKey, Partial<YouthProfile>, string]> = [
  ['firstName', { firstName: 'Other' }, 'other'],
  ['lastName', { lastName: 'Other' }, 'other'],
  ['dateOfBirth', { dateOfBirth: '2012-01-01' }, '2012-01-01'],
  ['school', { schoolName: 'Other' }, 'other'],
  ['activeProgram', { activeProgram: { programId: 'program-1', program: 'Other' } }, 'other'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getYouthSortValue({ ...row, ...changes }, key)).toEqual(expected);
});

it('normalizes nullable school and date values like the server', () => {
  expect(getYouthSortValue({ ...row, schoolName: null }, 'school')).toBe('');
  expect(getYouthSortValue({ ...row, activeProgram: null }, 'activeProgram')).toBe('');
  expect(getYouthSortValue({ ...row, dateOfBirth: null }, 'dateOfBirth')).toBe('');
});
