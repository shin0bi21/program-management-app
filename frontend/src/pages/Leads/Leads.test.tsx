import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Leads from './Leads';
import type { LeadPreference } from './hooks/preferences/useLeadPreferences';

const renderPage = (
  origin: 'external' | 'internal' = 'external',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) => {
  return render(
    <QueryClientProvider client={queryClient}><Leads origin={origin} /></QueryClientProvider>,
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
  deleteLead: (...args: unknown[]) => deleteLead(...args),
  signUpLead: (...args: unknown[]) => signUpLead(...args),
  getLeadNotes: (...args: unknown[]) => getLeadNotes(...args),
  updateLeadStatus: (...args: unknown[]) => updateLeadStatus(...args),
}));

vi.mock('../../auth/authContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));
vi.mock('../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

vi.mock('../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], loading: false, error: '' }),
}));

vi.mock('../../common/features/programming/api/cohorts.api', () => ({
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
      id: 'lead-1', origin: 'external', submittedByRole: 'parent', convertedYouthId: 'youth-1',
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
      id: 'lead-1', origin: 'external', submittedByRole: 'parent', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgramName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }]);
  });

  it('shows who filled out an external lead', async () => {
    renderPage();
    expect(await screen.findByRole('columnheader', { name: 'Filled Out By' })).toBeInTheDocument();
    expect(await screen.findByRole('cell', { name: 'Parent' })).toBeInTheDocument();
  });

  it('filters external leads by who filled out the form', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Filled Out By/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Parent' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ origins: ['external'], submitterRoles: ['parent'] }),
      expect.any(Object),
      { signal: expect.any(AbortSignal) },
    ));
  });

  it('does not show the filled-out-by field for internal leads', async () => {
    const internalLead = {
      id: 'lead-1',
      origin: 'internal',
      submittedByRole: 'staff',
      convertedYouthId: null,
      youthFirstName: 'Avery',
      youthLastName: 'Outreach',
      age: 14,
      school: 'Outreach Test School',
      recommendedProgramId: 'program-1',
      recommendedProgramName: 'Soft Skills',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian',
      discoverySource: 'community_outreach',
      notes: null,
      status: 'new',
      statusUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as const;
    getLeads.mockResolvedValueOnce([internalLead]);
    renderPage('internal');

    await screen.findByRole('row', { name: /Avery Outreach/ });
    expect(screen.queryByRole('columnheader', { name: 'Filled Out By' })).not.toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Staff' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: /Filled Out By/ })).not.toBeInTheDocument();
  });

  it('shows primary contact details when a lead row is selected', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('No intake information recorded.')).toBeInTheDocument();
  });

  it('keeps the selected dashboard synchronized with status responses', async () => {
    const initialLead = (await getLeads())[0];
    const updatedLead = { ...initialLead, status: 'contacted', contactPhoneNumber: '416-555-0199' };
    updateLeadStatus.mockResolvedValue(updatedLead);
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

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('lead-1'));
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

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('lead-2'));
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
  });

  it('opens the selected Lead for editing from its actions menu', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toHaveValue('Avery');
  });

});
