import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpressionsOfInterest from './ExpressionsOfInterest';

const getExpressions = vi.fn();
const convertExpression = vi.fn();

vi.mock('./api/expressionsOfInterest.api', () => ({
  getExpressionsOfInterest: (...args: unknown[]) => getExpressions(...args),
  updateExpressionOfInterestStatus: vi.fn(),
  convertExpressionOfInterest: (...args: unknown[]) => convertExpression(...args),
}));

vi.mock('../../../common/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], setPrograms: vi.fn(), loading: false, error: '' }),
}));

vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));

describe('ExpressionsOfInterest', () => {
  beforeEach(() => {
    convertExpression.mockReset();
    convertExpression.mockResolvedValue({ id: 'lead-1' });
    getExpressions.mockResolvedValue([{
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School',
      contactPhoneNumber: '416-555-0100', contactRelationship: 'parent', discoverySource: 'online',
      notes: 'Follow up next week', status: 'new', createdAt: new Date().toISOString(), statusUpdatedAt: new Date().toISOString(),
      suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    }]);
  });

  it('shows contact and notes when a row is selected without View buttons', async () => {
    render(<MemoryRouter><ExpressionsOfInterest /></MemoryRouter>);
    const youthName = await screen.findByText('Avery Interest');

    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    fireEvent.click(youthName.closest('tr')!);
    expect(screen.getByText('416-555-0100')).toBeInTheDocument();
    expect(screen.getByText('Follow up next week')).toBeInTheDocument();
  });

  it('renders the inferred program without a create action', async () => {
    render(<MemoryRouter><ExpressionsOfInterest /></MemoryRouter>);

    expect(await screen.findByText('Avery Interest')).toBeInTheDocument();
    expect(screen.getByText('Test School')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('stays on expressions of interest and marks the row converted after conversion', async () => {
    render(<MemoryRouter><ExpressionsOfInterest /></MemoryRouter>);
    await screen.findByText('Avery Interest');

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Interest' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Convert to Lead' }));

    await waitFor(() => expect(convertExpression).toHaveBeenCalledWith('expression-1'));
    expect(await screen.findByText('Converted')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Expressions of interest' })).toBeInTheDocument();
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
