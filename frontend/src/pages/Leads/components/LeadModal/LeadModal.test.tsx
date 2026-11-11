import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeadModal from './LeadModal';
import type { Lead } from '../../types';

const createLead = vi.fn();
const updateLead = vi.fn();

vi.mock('../../leads.api', () => ({
  createLead: (...args: unknown[]) => createLead(...args),
  updateLead: (...args: unknown[]) => updateLead(...args),
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


  it('validates and submits a normalized direct lead', async () => {
    const onClose = vi.fn();
    const onSuccess = vi.fn();
    render(<LeadModal isOpen onClose={onClose} onSuccess={onSuccess} />);

    fireEvent.change(document.getElementById('lead-youthFirstName')!, { target: { value: ' Avery ' } });
    fireEvent.change(document.getElementById('lead-youthLastName')!, { target: { value: ' Outreach ' } });
    fireEvent.change(document.getElementById('lead-dateOfBirth')!, { target: { value: `${new Date().getFullYear() - 14}-01-01` } });
    fireEvent.change(document.getElementById('lead-school')!, { target: { value: ' Test School ' } });
    fireEvent.change(document.getElementById('lead-contactPhoneNumber')!, { target: { value: ' 416-555-0142 ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Relationship' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Parent' }));
    fireEvent.click(screen.getByRole('button', { name: 'How Did You Hear About Us?' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Online' }));
    fireEvent.submit(document.getElementById('lead-form')!);

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ id: 'lead-1' }));
    expect(screen.getByText('Lead created successfully!')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Create Lead' })).toBeInTheDocument();
    expect(document.getElementById('lead-youthFirstName')).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prefills and updates an existing Lead', async () => {
    const lead: Lead = {
      id: 'lead-1', origin: 'internal' as const, submittedByRole: 'staff' as const, convertedYouthId: null,
      youthFirstName: 'Avery', youthLastName: 'Outreach', dateOfBirth: `${new Date().getFullYear() - 14}-01-01`, age: 14, school: 'Test School',
      recommendedProgramId: null, recommendedProgram: null,
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
