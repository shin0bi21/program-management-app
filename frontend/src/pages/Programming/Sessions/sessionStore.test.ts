// @vitest-environment node
import { expect, it } from 'vitest';
import type { ProgramSession, SessionSortKey } from './types';
import { makeProgramSession } from '../../../tests/factories/session';
import { getSessionSortValue } from './sessionStore';

const row = makeProgramSession();

const sortValues: Array<[SessionSortKey, Partial<ProgramSession>, string | Date]> = [
  ['program', { program: 'Other' }, 'other'],
  ['cycle', { cycle: 'Other' }, 'other'],
  ['theme', { theme: 'Other' }, 'other'],
  ['date', { startsAt: '2027-01-01T12:00:00Z' }, new Date('2027-01-01T12:00:00Z')],
  ['time', { startsAt: '2027-01-01T12:00:00Z' }, new Date('2027-01-01T12:00:00Z')],
  ['type', { sessionType: 'Field Trip' }, 'field trip'],
  ['status', { state: 'cancelled' }, 'cancelled'],
];

it.each(sortValues)('maps %s to its canonical sort value', (key, changes, expected) => {
  expect(getSessionSortValue({ ...row, ...changes }, key)).toEqual(expected);
});

it('compares timestamp instants independently of their serialized offset', () => {
  expect(getSessionSortValue({ ...row, startsAt: '2026-10-01T12:00:00Z' }, 'date')).toEqual(getSessionSortValue({ ...row, startsAt: '2026-10-01T08:00:00-04:00' }, 'date'));
});
