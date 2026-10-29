import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeadModal from './LeadModal';

const createLead = vi.fn();
const updateLead = vi.fn();

vi.mock('../../leads.api', () => ({
  createLead: (...args: unknown[]) => createLead(...args),
  updateLead: (...args: unknown[]) => updateLead(...args),
}));

vi.mock('../../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Future Ready' }], setPrograms: vi.fn(), loading: false, error: '' }),
}));

vi.mock('../../../../auth/authContext', () => ({
  useAuth: () => ({ permissions: ['write:programs'] }),
}));

describe('LeadModal', () => {
  beforeEach(() => {
    createLead.mockReset();
    updateLead.mockReset();
    createLead.mockResolvedValue({ id: 'lead-1' });
  });

  it('uses the established section and modal-footer structure', () => {
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Create Lead' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Youth Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Primary Contact' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Follow-up Information' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /notes/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    expect(screen.queryByRole('menuitemradio', { name: 'Emergency Contact' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('requires a date of birth before creating a lead', async () => {
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);
    fireEvent.submit(document.getElementById('lead-form')!);
    expect(await screen.findByText('Date of birth is required')).toBeInTheDocument();
    expect(createLead).not.toHaveBeenCalled();
  });

  it('validates and submits a normalized direct lead', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<LeadModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(document.getElementById('lead-youthFirstName')!, { target: { value: ' Avery ' } });
    fireEvent.change(document.getElementById('lead-youthLastName')!, { target: { value: ' Outreach ' } });
    fireEvent.change(document.getElementById('lead-dateOfBirth')!, { target: { value: `${new Date().getFullYear() - 14}-01-01` } });
    fireEvent.change(document.getElementById('lead-school')!, { target: { value: ' Test School ' } });
    fireEvent.change(document.getElementById('lead-contactPhoneNumber')!, { target: { value: ' 416-555-0142 ' } });
    fireEvent.submit(document.getElementById('lead-form')!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'lead-1' }));
    expect(screen.getByText('Lead created successfully!')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Create Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prefills and updates an existing Lead', async () => {
    const lead = {
      id: 'lead-1', origin: 'internal' as const, submittedByRole: 'staff' as const, convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, dateOfBirth: `${new Date().getFullYear() - 14}-01-01`, school: 'Test School',
      recommendedProgramId: null, recommendedProgramName: null,
      contactPhoneNumber: '416-555-0142',
      contactRelationship: 'guardian' as const, discoverySource: 'online' as const, notes: null,
      status: 'new' as const, statusUpdatedAt: new Date().toISOString(), createdAt: new Date().toISOString(),
    };
    updateLead.mockResolvedValue(lead);

    render(<LeadModal isOpen lead={lead} onClose={vi.fn()} onSuccess={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toHaveValue('Avery');

    fireEvent.change(document.getElementById('lead-school')!, { target: { value: ' Updated School ' } });
    fireEvent.submit(document.getElementById('lead-form')!);

    await waitFor(() => expect(screen.getByText('Lead updated successfully!')).toBeInTheDocument());
    expect(updateLead).toHaveBeenCalledWith(lead.id, expect.objectContaining({ dateOfBirth: lead.dateOfBirth }));
    expect(updateLead.mock.calls[0][1]).not.toHaveProperty('age');
    expect(createLead).not.toHaveBeenCalled();
  });
});
