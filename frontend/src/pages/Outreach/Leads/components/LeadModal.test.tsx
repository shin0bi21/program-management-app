import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LeadModal from './LeadModal';

const createLead = vi.fn();

vi.mock('../api/leads.api', () => ({
  createLead: (...args: unknown[]) => createLead(...args),
}));

describe('LeadModal', () => {
  beforeEach(() => {
    createLead.mockReset();
    createLead.mockResolvedValue({ id: 'lead-1' });
  });

  it('uses the established section and modal-footer structure', () => {
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Create Lead' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'General Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Primary Contact' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Follow-up Information' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('validates and submits a normalized direct lead', async () => {
    render(<LeadModal isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    fireEvent.change(document.getElementById('lead-youthFirstName')!, { target: { value: ' Avery ' } });
    fireEvent.change(document.getElementById('lead-youthLastName')!, { target: { value: ' Outreach ' } });
    fireEvent.change(document.getElementById('lead-age')!, { target: { value: '14' } });
    fireEvent.change(document.getElementById('lead-school')!, { target: { value: ' Test School ' } });
    fireEvent.change(document.getElementById('lead-contactFirstName')!, { target: { value: ' Jordan ' } });
    fireEvent.change(document.getElementById('lead-contactLastName')!, { target: { value: ' Outreach ' } });
    fireEvent.change(document.getElementById('lead-contactPhoneNumber')!, { target: { value: ' 416-555-0142 ' } });
    fireEvent.submit(document.getElementById('lead-form')!);

    await waitFor(() => expect(createLead).toHaveBeenCalledWith(expect.objectContaining({
      youthFirstName: 'Avery', youthLastName: 'Outreach', age: 14, school: 'Test School',
      contactFirstName: 'Jordan', contactLastName: 'Outreach', contactPhoneNumber: '416-555-0142',
      contactRelationship: 'parent', discoverySource: 'online',
    })));
  });
});
