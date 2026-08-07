import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpressionsOfInterest from './ExpressionsOfInterest';

const renderPage = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><ExpressionsOfInterest /></MemoryRouter>
    </QueryClientProvider>,
  );
};

const getExpressions = vi.fn();
const convertExpression = vi.fn();
const preferenceHook = vi.hoisted(() => ({ preference: null, loading: false, error: null, save: vi.fn() }));

vi.mock('./api/expressionsOfInterest.api', () => ({
  getExpressionsOfInterest: (...args: unknown[]) => getExpressions(...args),
  updateExpressionOfInterestStatus: vi.fn(),
  convertExpressionOfInterest: (...args: unknown[]) => convertExpression(...args),
}));

vi.mock('../../../features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], setPrograms: vi.fn(), loading: false, error: '' }),
}));

vi.mock('../../../common/context/AuthContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));
vi.mock('../../../common/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

describe('ExpressionsOfInterest', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.save.mockReset();
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
    renderPage();
    const youthName = await screen.findByText('Avery Interest');

    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    fireEvent.click(youthName.closest('tr')!);
    expect(screen.getByText('416-555-0100')).toBeInTheDocument();
    expect(screen.getByText('Follow up next week')).toBeInTheDocument();
  });

  it('renders the inferred program without a create action', async () => {
    renderPage();

    expect(await screen.findByText('Avery Interest')).toBeInTheDocument();
    expect(screen.getByText('Test School')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('stays on expressions of interest and marks the row converted after conversion', async () => {
    renderPage();
    await screen.findByText('Avery Interest');

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Interest' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Convert to Lead' }));

    await waitFor(() => expect(convertExpression).toHaveBeenCalledWith('expression-1'));
    expect(await screen.findByText('Converted')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Expressions of interest' })).toBeInTheDocument();
  });

  it('requests expressions filtered by inferred program', async () => {
    renderPage();
    await screen.findByText('Avery Interest');

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
    const programFilter = screen.getByRole('menuitem', { name: /Program/ });
    const statusFilter = screen.getByRole('menuitem', { name: /Status/ });
    expect(programFilter.compareDocumentPosition(statusFilter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(programFilter);
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Soft Skills' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Apply' }));

    await waitFor(() => expect(getExpressions).toHaveBeenLastCalledWith(
      { search: '', statuses: [], programIds: ['program-1'] },
      expect.objectContaining({ key: 'createdAt', direction: 'desc', limit: 25 }),
      { signal: expect.any(AbortSignal) },
    ));
  });
});
