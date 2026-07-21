import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpressionsOfInterest from './ExpressionsOfInterest';

const getExpressions = vi.fn();

vi.mock('./api/expressionsOfInterest.api', () => ({
  getExpressionsOfInterest: (...args: unknown[]) => getExpressions(...args),
  updateExpressionOfInterestStatus: vi.fn(),
  convertExpressionOfInterest: vi.fn(),
}));

vi.mock('../../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], setPrograms: vi.fn(), loading: false, error: '' }),
}));

vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));

describe('ExpressionsOfInterest', () => {
  beforeEach(() => {
    getExpressions.mockResolvedValue([{
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School', contactFirstName: 'Parent', contactLastName: 'Contact',
      contactPhoneNumber: '416-555-0100', contactRelationship: 'parent', discoverySource: 'online',
      notes: null, status: 'new', createdAt: new Date().toISOString(), statusUpdatedAt: new Date().toISOString(),
      suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    }]);
  });

  it('renders the inferred program without a create action', async () => {
    render(<MemoryRouter><ExpressionsOfInterest /></MemoryRouter>);

    expect(await screen.findByText('Avery Interest')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('requests expressions filtered by inferred program', async () => {
    render(<MemoryRouter><ExpressionsOfInterest /></MemoryRouter>);
    await screen.findByText('Avery Interest');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Program/ }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getExpressions).toHaveBeenLastCalledWith({ search: '', statuses: [], programIds: ['program-1'] }));
  });
});
