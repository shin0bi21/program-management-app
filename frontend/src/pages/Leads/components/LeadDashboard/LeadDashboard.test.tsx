// Owns LeadDashboard rendered behavior and owner wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Lead } from '../../types';
import LeadDashboard from './LeadDashboard';

vi.mock('./LeadNotesDashboardCard/LeadNotesDashboardCard', () => ({
  default: ({ lead, canWrite }: { lead: Lead | null; canWrite: boolean }) => (
    <div>{lead?.id ?? 'no-lead'}:{canWrite ? 'writable' : 'read-only'}</div>
  ),
}));

const lead: Lead = {
  id: 'lead-1',
  origin: 'external',
  submittedByRole: 'parent',
  convertedYouthId: null,
  youthFirstName: 'Avery',
  youthLastName: 'Outreach',
  age: 14,
  school: 'Test School',
  recommendedProgramId: null,
  recommendedProgramName: null,
  contactPhoneNumber: '519-555-0100',
  contactRelationship: 'parent',
  discoverySource: 'online',
  notes: 'Call after school.',
  status: 'new',
  statusUpdatedAt: '2026-08-19T12:00:00.000Z',
  createdAt: '2026-08-19T12:00:00.000Z',
};

describe('LeadDashboard', () => {
  it('composes contact, intake, and follow-up cards for the selected lead', () => {
    render(<LeadDashboard lead={lead} canWrite />);

    expect(screen.getByText('519-555-0100')).toBeInTheDocument();
    expect(screen.getByText('Call after school.')).toBeInTheDocument();
    expect(screen.getByText('lead-1:writable')).toBeInTheDocument();
  });
});
