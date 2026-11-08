import { renderWithQueryClient } from '../../tests/queryClientTestUtils';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Leads from './Leads';

/**
 * Renders the requested outreach collection with an isolated query cache.
 * @param origin - Internal or external leads collection to exercise.
 * @example renderPage('internal')
 */
const renderPage = (origin: 'external' | 'internal' = 'external') => (
  renderWithQueryClient(<Leads origin={origin} />)
);

const getLeads = vi.fn();
const updateLead = vi.fn();
const updateLeadStatus = vi.fn();
const deleteLead = vi.fn();
const signUpLead = vi.fn();
const getLeadNotes = vi.fn();
const preferenceApi = vi.hoisted(() => ({ getPreference: vi.fn(), setPreference: vi.fn() }));

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
vi.mock('../../common/features/Preferences/preferences.api', () => preferenceApi);

vi.mock('../../common/features/referenceData/hooks/useReferenceData', async importOriginal => ({
  ...await importOriginal<typeof import('../../common/features/referenceData/hooks/useReferenceData')>(),
  useProgramReferences: () => ({ rows: [{ id: 'program-1', name: 'Future Ready' }], loading: false, error: '' }),
}));

vi.mock('../Programming/Programs/api/programCycleAssignments.api', () => ({
  getProgramCycleAssignments: vi.fn().mockResolvedValue([]),
}));

describe('Leads', () => {
  beforeEach(() => {
    preferenceApi.getPreference.mockResolvedValue(null);
    preferenceApi.setPreference.mockImplementation((_key, value) => Promise.resolve(value));
    signUpLead.mockResolvedValue({ lead: {
      id: 'lead-1', origin: 'external', submittedByRole: 'parent', convertedYouthId: 'youth-1',
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgram: 'Future Ready',
      contactPhoneNumber: '416-555-0142', contactRelationship: 'guardian',
      discoverySource: 'community_outreach', notes: null, status: 'signed_up',
      statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    } });
    updateLeadStatus.mockReset();
    updateLead.mockReset();
    deleteLead.mockReset();
    deleteLead.mockResolvedValue({ id: 'lead-1' });
    getLeads.mockReset();
    getLeadNotes.mockResolvedValue([]);
    getLeads.mockResolvedValue({ rows: [{
      id: 'lead-1', origin: 'external', submittedByRole: 'parent', convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`, school: 'Outreach Test School',
      recommendedProgramId: 'program-1', recommendedProgram: 'Future Ready',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian', discoverySource: 'community_outreach', notes: null,
      status: 'new', statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    }], nextCursor: null });
  });

  // Controls and views.
  it('keeps the filled-out-by filter unavailable for internal leads', async () => {
    const internalLead = {
      id: 'lead-1',
      origin: 'internal',
      submittedByRole: 'staff',
      convertedYouthId: null,
      youthFirstName: 'Avery',
      youthLastName: 'Outreach',
      age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
      school: 'Outreach Test School',
      recommendedProgramId: 'program-1',
      recommendedProgram: 'Future Ready',
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian',
      discoverySource: 'community_outreach',
      notes: null,
      status: 'new',
      statusUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    } as const;
    getLeads.mockResolvedValueOnce({ rows: [internalLead], nextCursor: null });
    renderPage('internal');

    await screen.findByRole('row', { name: /Avery Outreach/ });
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    expect(screen.queryByRole('menuitem', { name: /Filled Out By/ })).not.toBeInTheDocument();
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

  // Selection and coordination.
  it('keeps the selected dashboard synchronized with status responses', async () => {
    const initialLead = (await getLeads()).rows[0];
    const updatedLead = { ...initialLead, status: 'contacted', contactPhoneNumber: '416-555-0199' };
    updateLeadStatus.mockResolvedValue(updatedLead);
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Mark Contacted' }));

    expect(await screen.findByText('416-555-0199')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('refreshes the selected saved lead without replacing an open edit draft', async () => {
    const initialLead = (await getLeads()).rows[0];
    const { queryClient } = renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Phone Number *'), { target: { value: '416-555-0188' } });
    const readsBeforeRefresh = getLeads.mock.calls.length;
    getLeads.mockResolvedValue({ rows: [{ ...initialLead, contactPhoneNumber: '416-555-0199' }], nextCursor: null });

    await act(async () => queryClient.invalidateQueries({ queryKey: ['leads', 'table'] }));

    expect(await screen.findByText('416-555-0199')).toBeInTheDocument();
    expect(screen.getByLabelText('Phone Number *')).toHaveValue('416-555-0188');
    expect(getLeads).toHaveBeenCalledTimes(readsBeforeRefresh + 1);
  });

  it('keeps the selected dashboard synchronized after editing', async () => {
    const initialLead = (await getLeads()).rows[0];
    updateLead.mockResolvedValue({ ...initialLead, contactPhoneNumber: '416-555-0188' });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Phone Number *'), { target: { value: '416-555-0188' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('416-555-0188')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('keeps the selected dashboard synchronized after sign-up', async () => {
    const initialLead = (await getLeads()).rows[0];
    signUpLead.mockResolvedValue({ lead: {
      ...initialLead,
      status: 'signed_up',
      convertedYouthId: 'youth-1',
      contactPhoneNumber: '416-555-0177',
    } });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign Up' }));
    const submit = screen.getByRole('button', { name: 'Save' });
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);

    expect(await screen.findByText('416-555-0177')).toBeInTheDocument();
    expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument();
  });

  it('shows primary contact details when a lead row is selected', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));

    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    expect(screen.getByText('No intake information recorded.')).toBeInTheDocument();
  });

  it('clears a selected dashboard after deleting that lead', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('lead-1'));
    await waitFor(() => expect(screen.queryByText('416-555-0142')).not.toBeInTheDocument());
  });

  it('preserves the selected dashboard after deleting another lead', async () => {
    const initialLead = (await getLeads()).rows[0];
    const otherLead = {
      ...initialLead,
      id: 'lead-2',
      youthFirstName: 'Sam',
      youthLastName: 'Stable',
      contactPhoneNumber: '416-555-0101',
    };
    getLeads.mockResolvedValue({ rows: [initialLead, otherLead], nextCursor: null });
    deleteLead.mockResolvedValue({ id: 'lead-2' });
    renderPage();
    fireEvent.click(await screen.findByRole('row', { name: /Avery Outreach/ }));
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Sam Stable' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteLead).toHaveBeenCalledWith('lead-2'));
    expect(screen.getByText('416-555-0142')).toBeInTheDocument();
  });

  // Commands and dialogs.

  it('opens the selected Lead for editing from its actions menu', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Outreach/ });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Outreach' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByRole('heading', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toHaveValue('Avery');
  });

});
