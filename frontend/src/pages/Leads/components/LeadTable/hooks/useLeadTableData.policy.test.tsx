// @vitest-environment node
import { expect, it } from 'vitest';
import type { Lead, LeadSortKey } from '../../../types';
import { getLeadSortValue } from './useLeadTableData';

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
  expect(getLeadSortValue({ ...row, ...changes }, key)).toEqual(expected);
});

it('compares timestamp instants independently of their serialized offset', () => {
  expect(getLeadSortValue({ ...row, createdAt: '2026-10-01T08:00:00-04:00' }, 'created')).toEqual(new Date('2026-10-01T12:00:00Z'));
});
