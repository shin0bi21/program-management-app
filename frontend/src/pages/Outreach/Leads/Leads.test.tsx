import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Leads from './Leads';

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}><Leads /></QueryClientProvider>,
  );
};

const getLeads = vi.fn();
const updateLead = vi.fn();
const updateLeadStatus = vi.fn();
const signUpLead = vi.fn();
const getLeadNotes = vi.fn();
const preferenceHook = vi.hoisted(() => ({ preference: null, loading: false, error: null, save: vi.fn() }));

vi.mock('./api/leads.api', () => ({
  getLeads: (...args: unknown[]) => getLeads(...args),
  createLead: vi.fn(),
  updateLead: (...args: unknown[]) => updateLead(...args),
  updateLeadStatus: (...args: unknown[]) => updateLeadStatus(...args),
  signUpLead: (...args: unknown[]) => signUpLead(...args),
  getLeadNotes: (...args: unknown[]) => getLeadNotes(...args),
  createLeadNote: vi.fn(),
  updateLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../../common/features/programming/api/programming.api', () => ({
  getCohorts: vi.fn().mockResolvedValue([]),
}));

describe('Leads', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.save.mockReset();
    signUpLead.mockResolvedValue({
      id: 'lead-1', origin: 'expression_of_interest', expressionOfInterestId: 'submission-1', convertedYouthId: 'youth-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      programOfInterestId: 'program-1', programOfInterestName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142', contactRelationship: 'guardian',
      discoverySource: 'community_outreach', notes: null, status: 'signed_up',
      statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });
    updateLeadStatus.mockReset();
    getLeadNotes.mockResolvedValue([]);
    getLeads.mockResolvedValue([{
      id: 'lead-1', origin: 'expression_of_interest', expressionOfInterestId: 'submission-1', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      programOfInterestId: 'program-1', programOfInterestName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);
  });

  it('updates only the changed lead after a status change', async () => {
    updateLeadStatus.mockResolvedValue({
      id: 'lead-1', origin: 'expression_of_interest', expressionOfInterestId: 'submission-1', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      programOfInterestId: 'program-1', programOfInterestName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'contacted', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });
    const initialRequestCount = getLeads.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Contacted' }));

    await waitFor(() => expect(updateLeadStatus).toHaveBeenCalledWith('lead-1', 'contacted'));
    expect(await screen.findByText('Contacted')).toBeInTheDocument();
    expect(getLeads).toHaveBeenCalledTimes(initialRequestCount);
    expect(screen.queryByRole('status', { name: 'Updating rows' })).not.toBeInTheDocument();
  });

  it('signs up a Lead through the dedicated conversion action', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Up' }));
    expect(screen.getByRole('heading', { name: 'Sign Up Lead' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Mark Signed Up' })).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Create Profile' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(signUpLead).toHaveBeenCalledWith('lead-1', null));
    expect(await screen.findByText(
      'Youth profile successfully created for Avery Outreach.',
    )).toBeInTheDocument();
  });

  it('renders fetched leads and direct-create access', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /First Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    await screen.findByRole('row', { name: /Avery Outreach/ });
    expect(screen.getByRole('cell', { name: 'Avery' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.queryByText('Expression of Interest')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Add' })).toBeInTheDocument();
  });

  it('shows primary contact details when a lead row is selected', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('No notes recorded.')).toBeInTheDocument();
  });

  it('requests filtered lead data from the API', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      { search: '', statuses: ['new'], programIds: [] },
      expect.objectContaining({ key: 'createdAt', direction: 'desc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));
  });

  it('requests leads filtered by program', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const programFilter = screen.getByRole('menuitem', { name: /Program/ });
    const statusFilter = screen.getByRole('menuitem', { name: /Status/ });
    expect(programFilter.compareDocumentPosition(statusFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(programFilter);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      { search: '', statuses: [], programIds: ['program-1'] },
      expect.objectContaining({ key: 'createdAt', direction: 'desc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));
  });

  it('opens the selected Lead for editing from its actions menu', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toHaveValue('Avery');
  });

  it('does not offer edit actions for a signed-up lead', async () => {
    getLeads.mockResolvedValueOnce([{
      id: 'lead-1', origin: 'expression_of_interest', expressionOfInterestId: 'submission-1',
      convertedYouthId: 'youth-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      programOfInterestId: 'program-1', programOfInterestName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'signed_up', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);

    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    expect(screen.queryByRole('button', { name: 'More actions for Avery Outreach' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).not.toBeInTheDocument();
  });
});
