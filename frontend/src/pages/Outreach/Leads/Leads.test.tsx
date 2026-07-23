import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Leads from './Leads';

const getLeads = vi.fn();
const updateLead = vi.fn();
const signUpLead = vi.fn();

vi.mock('./api/leads.api', () => ({
  getLeads: (...args: unknown[]) => getLeads(...args),
  createLead: vi.fn(),
  updateLead: (...args: unknown[]) => updateLead(...args),
  updateLeadStatus: vi.fn(),
  signUpLead: (...args: unknown[]) => signUpLead(...args),
}));

vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));

vi.mock('../../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

describe('Leads', () => {
  beforeEach(() => {
    signUpLead.mockResolvedValue({});
    getLeads.mockResolvedValue([{
      id: 'lead-1', origin: 'expression_of_interest', expressionOfInterestId: 'submission-1', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      programId: 'program-1', programName: 'Soft Skills',
      contactFirstName: 'Jordan', contactLastName: 'Outreach', contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);
  });

  it('signs up a Lead through the dedicated conversion action', async () => {
    render(<Leads />);
    await screen.findByText('Avery Outreach');

    fireEvent.click(screen.getByRole('button', { name: '' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Up' }));
    expect(screen.getByRole('heading', { name: 'Sign Up Lead' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Mark Signed Up' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
    await waitFor(() => expect(signUpLead).toHaveBeenCalledWith('lead-1'));
  });

  it('renders fetched leads and direct-create access', async () => {
    render(<Leads />);

    expect(await screen.findByText('Avery Outreach')).toBeInTheDocument();
    expect(screen.getByText('Expression of Interest')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Create Lead' })).toBeInTheDocument();
  });

  it('requests filtered lead data from the API', async () => {
    render(<Leads />);
    await screen.findByText('Avery Outreach');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith({ search: '', statuses: ['new'], programIds: [] }));
  });

  it('requests leads filtered by program', async () => {
    render(<Leads />);
    await screen.findByText('Avery Outreach');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith({ search: '', statuses: [], programIds: ['program-1'] }));
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
