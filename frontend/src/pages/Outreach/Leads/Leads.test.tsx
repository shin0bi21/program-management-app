import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Leads from './Leads';
import { YOUTH_QUERY_KEY } from '../../../common/features/youth/queryKeys';
import { COHORT_QUERY_KEY } from '../../../common/features/programming/queryKeys';
import type { LeadPreference } from './types';

const LEADS_TABLE_QUERY_KEY = ['leads', 'external', 'table'] as const;

const renderPage = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  return render(
    <QueryClientProvider client={queryClient}><Leads origin="external" /></QueryClientProvider>,
  );
};

const getLeads = vi.fn();
const updateLead = vi.fn();
const updateLeadStatus = vi.fn();
const deleteLead = vi.fn();
const signUpLead = vi.fn();
const getLeadNotes = vi.fn();
const preferenceHook = vi.hoisted(() => ({
  preference: null as LeadPreference | null,
  loading: false,
  error: null,
  initializePreference: vi.fn(),
  save: vi.fn(),
}));

vi.mock('./leads.api', () => ({
  getLeads: (...args: unknown[]) => getLeads(...args),
  createLead: vi.fn(),
  updateLead: (...args: unknown[]) => updateLead(...args),
  updateLeadStatus: (...args: unknown[]) => updateLeadStatus(...args),
  deleteLead: (...args: unknown[]) => deleteLead(...args),
  signUpLead: (...args: unknown[]) => signUpLead(...args),
  getLeadNotes: (...args: unknown[]) => getLeadNotes(...args),
  setLeadNote: vi.fn(),
  deleteLeadNote: vi.fn(),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../../common/features/programming/api/cohorts.api', () => ({
  getCohorts: vi.fn().mockResolvedValue([]),
}));

describe('Leads', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.initializePreference.mockImplementation((value: LeadPreference) => {
      preferenceHook.preference = value;
    });
    preferenceHook.save.mockReset();
    preferenceHook.save.mockImplementation((
      update: LeadPreference | ((current: LeadPreference | null) => LeadPreference),
    ) => {
      preferenceHook.preference = typeof update === 'function'
        ? update(preferenceHook.preference)
        : update;
    });
    signUpLead.mockResolvedValue({
      id: 'lead-1', origin: 'external', convertedYouthId: 'youth-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142', contactRelationship: 'guardian',
      discoverySource: 'community_outreach', notes: null, status: 'signed_up',
      statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    });
    updateLeadStatus.mockReset();
    updateLead.mockReset();
    deleteLead.mockReset();
    deleteLead.mockResolvedValue({ id: 'lead-1' });
    getLeads.mockReset();
    getLeadNotes.mockResolvedValue([]);
    getLeads.mockResolvedValue([{
      id: 'lead-1', origin: 'external', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);
  });

  it('replaces the authoritative Lead after a status change without refetching the table', async () => {
    const contactedLead = {
      id: 'lead-1', origin: 'external', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'contacted', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    } as const;
    updateLeadStatus.mockResolvedValue(contactedLead);
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });
    const initialRequestCount = getLeads.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Contacted' }));

    await waitFor(() => expect(updateLeadStatus).toHaveBeenCalledWith('lead-1', 'contacted'));
    expect(await screen.findByText('Contacted')).toBeInTheDocument();
    expect(getLeads).toHaveBeenCalledTimes(initialRequestCount);
  });

  it('signs up a Lead through the dedicated conversion action', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    renderPage(queryClient);
    await screen.findByRole('row', { name: /Avery Outreach/ });
    const initialRequestCount = getLeads.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Up' }));
    expect(screen.getByRole('heading', { name: 'Sign Up Lead' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Mark Signed Up' })).not.toBeInTheDocument();

    const submit = screen.getByRole('button', { name: 'Create Profile' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(signUpLead).toHaveBeenCalledWith('lead-1', null));
    for (const queryKey of [YOUTH_QUERY_KEY, COHORT_QUERY_KEY]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: LEADS_TABLE_QUERY_KEY });
    expect(getLeads).toHaveBeenCalledTimes(initialRequestCount);
    expect(await screen.findByText('Signed Up')).toBeInTheDocument();
    expect(await screen.findByText(
      'Youth profile successfully created for Avery Outreach.',
    )).toBeInTheDocument();
  });

  it('renders fetched leads and direct-create access', async () => {
    renderPage();

    expect(await screen.findByRole('columnheader', { name: /First Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Origin' })).not.toBeInTheDocument();
    await screen.findByRole('row', { name: /Avery Outreach/ });
    expect(screen.getByRole('cell', { name: 'Avery' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Outreach' })).toBeInTheDocument();
    expect(screen.queryByText('Expression of Interest')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'External Leads' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Add' })).not.toBeInTheDocument();
  });

  it('requests independent first-name and last-name sorting', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'First Name' }));
    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ origins: ['external'] }),
      expect.objectContaining({ key: 'firstName', direction: 'asc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Last Name' }));
    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ origins: ['external'] }),
      expect.objectContaining({ key: 'lastName', direction: 'asc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));
    expect(preferenceHook.preference?.sorting).toEqual({ key: 'lastName', direction: 'asc' });
  });

  it('persists a complete preference when first hiding a column', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'School' }));

    expect(preferenceHook.preference).toEqual({
      statuses: [],
      programIds: [],
      origins: ['external'],
      sorting: { key: 'created', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: ['school'],
    });
  });

  it('keeps persisted controls and content unavailable until restoration completes', async () => {
    preferenceHook.loading = true;
    const rendered = renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved lead preferences…');
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Leads' })).not.toBeInTheDocument();
    expect(getLeads).not.toHaveBeenCalled();

    preferenceHook.loading = false;
    rendered.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Leads origin="external" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Leads' })).toBeInTheDocument();
  });

  it('shows primary contact details when a lead row is selected', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('No intake information recorded.')).toBeInTheDocument();
  });

  it('keeps the selected dashboard synchronized with status responses', async () => {
    const initialLead = (await getLeads())[0];
    updateLeadStatus.mockResolvedValue({ ...initialLead, status: 'contacted', contactPhoneNumber: '416-555-0199' });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Contacted' }));

    expect(await screen.findByText('416-555-0199')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('keeps the selected dashboard synchronized after editing', async () => {
    const initialLead = (await getLeads())[0];
    updateLead.mockResolvedValue({ ...initialLead, contactPhoneNumber: '416-555-0188' });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Phone Number *'), { target: { value: '416-555-0188' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Lead' }));

    expect(await screen.findByText('416-555-0188')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('keeps the selected dashboard synchronized after sign-up', async () => {
    const initialLead = (await getLeads())[0];
    signUpLead.mockResolvedValue({
      ...initialLead,
      status: 'signed_up',
      convertedYouthId: 'youth-1',
      contactPhoneNumber: '416-555-0177',
    });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Up' }));
    const submit = screen.getByRole('button', { name: 'Create Profile' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText('416-555-0177')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('clears a selected dashboard after deleting that lead', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Lead deleted')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument());
  });

  it('preserves the selected dashboard after deleting another lead', async () => {
    const initialLead = (await getLeads())[0];
    const otherLead = {
      ...initialLead,
      id: 'lead-2',
      youthFirstName: 'Sam',
      youthLastName: 'Stable',
      contactPhoneNumber: '416-555-0101',
    };
    getLeads.mockResolvedValue([initialLead, otherLead]);
    deleteLead.mockResolvedValue({ id: 'lead-2' });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Sam Stable' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Lead deleted')).toBeInTheDocument();
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
  });

  it('shows a status error without changing the selected dashboard', async () => {
    updateLeadStatus.mockRejectedValue(new Error('network unavailable'));
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Contacted' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to update lead status.');
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('requests filtered lead data from the API', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Status/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'New' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      { search: '', statuses: ['new'], programIds: [], origins: ['external'] },
      expect.objectContaining({ key: 'created', direction: 'desc', limit: 25 }),
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
      { search: '', statuses: [], programIds: ['program-1'], origins: ['external'] },
      expect.objectContaining({ key: 'created', direction: 'desc', limit: 25 }),
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
      id: 'lead-1', origin: 'external',
      convertedYouthId: 'youth-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills',
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
