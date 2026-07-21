import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Leads from './Leads';

const getLeads = vi.fn();
const updateLead = vi.fn();

vi.mock('./api/leads.api', () => ({
  getLeads: (...args: unknown[]) => getLeads(...args),
  createLead: vi.fn(),
  updateLead: (...args: unknown[]) => updateLead(...args),
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

  it('requests filtered lead data from the API', async () => {
    render(<Leads />);
    await screen.findByText('Avery Outreach');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith({ search: '', statuses: ['new'] }));
  });

  it('opens the selected Lead for editing from its actions menu', async () => {
    render(<Leads />);
    await screen.findByText('Avery Outreach');

    fireEvent.click(screen.getByRole('button', { name: '' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toHaveValue('Avery');
  });
});
