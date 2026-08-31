// Owns LeadModal rendered behavior and owner wiring.
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
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], setPrograms: vi.fn(), loading: false, error: '' }),
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

  it('validates and submits a normalized direct lead', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<LeadModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(document.getElementById('lead-youthFirstName')!, { target: { value: ' Avery ' } });
    fireEvent.change(document.getElementById('lead-youthLastName')!, { target: { value: ' Outreach ' } });
    fireEvent.change(document.getElementById('lead-age')!, { target: { value: '14' } });
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
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Test School',
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
    expect(createLead).not.toHaveBeenCalled();
  });
});
