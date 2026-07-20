import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Leads from './Leads';

const getLeads = vi.fn();

vi.mock('./api/leads.api', () => ({
  getLeads: (...args: unknown[]) => getLeads(...args),
  createLead: vi.fn(),
  updateLeadStatus: vi.fn(),
}));

vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));

describe('Leads', () => {
  beforeEach(() => {
    getLeads.mockResolvedValue([{
      id: 'lead-1', origin: 'interest_submission', interestSubmissionId: 'submission-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      responseEmail: 'avery@example.test', responsePhoneNumber: null,
      contactFirstName: 'Jordan', contactLastName: 'Outreach', contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);
  });

  it('renders fetched leads and direct-create access', async () => {
    render(<Leads />);

    expect(await screen.findByText('Avery Outreach')).toBeInTheDocument();
    expect(screen.getByText('Public Interest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Create Lead' })).toBeInTheDocument();
  });
});
