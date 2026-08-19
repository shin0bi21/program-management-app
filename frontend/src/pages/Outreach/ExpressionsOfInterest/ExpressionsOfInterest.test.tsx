import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExpressionsOfInterest from './ExpressionsOfInterest';
import type { ExpressionInterestPreference } from './types';

const renderPage = (queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><ExpressionsOfInterest /></MemoryRouter>
    </QueryClientProvider>,
  );
};

const getExpressions = vi.fn();
const convertExpression = vi.fn();
const preferenceHook = vi.hoisted(() => ({
  preference: null as ExpressionInterestPreference | null,
  loading: false,
  error: null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('./expressionsOfInterest.api', () => ({
  getExpressionsOfInterest: (...args: unknown[]) => getExpressions(...args),
  updateExpressionOfInterestStatus: vi.fn(),
  convertExpressionOfInterest: (...args: unknown[]) => convertExpression(...args),
}));

vi.mock('../../../common/features/programs/hooks/usePrograms', () => ({
  usePrograms: () => ({ programs: [{ id: 'program-1', name: 'Soft Skills' }], setPrograms: vi.fn(), loading: false, error: '' }),
}));

vi.mock('../../../auth/authContext', () => ({
  useAuth: () => ({ permissions: ['read:outreach', 'write:outreach'] }),
}));
vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({ default: () => preferenceHook }));

describe('ExpressionsOfInterest', () => {
  beforeEach(() => {
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
    preferenceHook.setBaseline.mockImplementation((value: ExpressionInterestPreference) => {
      preferenceHook.preference = value;
    });
    preferenceHook.save.mockReset();
    preferenceHook.save.mockImplementation((
      update: ExpressionInterestPreference
        | ((current: ExpressionInterestPreference | null) => ExpressionInterestPreference),
    ) => {
      preferenceHook.preference = typeof update === 'function'
        ? update(preferenceHook.preference)
        : update;
    });
    convertExpression.mockReset();
    getExpressions.mockReset();
    convertExpression.mockResolvedValue({ id: 'lead-1' });
    getExpressions.mockResolvedValue([{
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School',
      submittedByRole: 'parent',
      contactPhoneNumber: '416-555-0100', contactRelationship: 'parent', discoverySource: 'online',
      notes: 'Follow up next week', status: 'new', createdAt: new Date().toISOString(), statusUpdatedAt: new Date().toISOString(),
      suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    }]);
  });

  it('shows contact and notes when a row is selected without View buttons', async () => {
    renderPage();
    const youthRow = await screen.findByRole('row', { name: /Avery Interest/ });
    const table = screen.getByRole('table', { name: 'Expressions of interest' });

    expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /First Name/ })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Last Name' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Avery' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'Interest' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: /Filled Out By/ })).toBeInTheDocument();
    expect(within(table).getByText('Parent')).toBeInTheDocument();
    fireEvent.click(youthRow);
    expect(screen.getByText('416-555-0100')).toBeInTheDocument();
    expect(screen.getByText('Follow up next week')).toBeInTheDocument();
  });

  it('renders the inferred program without a create action', async () => {
    renderPage();

    expect(await screen.findByRole('row', { name: /Avery Interest/ })).toBeInTheDocument();
    expect(screen.getByText('Test School')).toBeInTheDocument();
    expect(screen.getByText('Soft Skills')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create/i })).not.toBeInTheDocument();
  });

  it('persists a complete preference when first hiding a column', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Interest/ });

    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'School' }));

    expect(preferenceHook.preference).toEqual({
      statuses: [],
      programIds: [],
      sorting: { key: 'createdAt', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: ['school'],
    });
  });

  it('keeps persisted controls and content unavailable until restoration completes', async () => {
    preferenceHook.loading = true;
    const rendered = renderPage();

    expect(screen.getByRole('status')).toHaveTextContent('Loading saved outreach preferences…');
    expect(screen.queryByRole('button', { name: 'Columns' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Expressions of interest' })).not.toBeInTheDocument();
    expect(getExpressions).not.toHaveBeenCalled();

    preferenceHook.loading = false;
    rendered.rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><ExpressionsOfInterest /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Columns' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Expressions of interest' })).toBeInTheDocument();
  });

  it('stays on expressions of interest and marks the row converted after conversion', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const convertedSubmission = {
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School', submittedByRole: 'parent',
      contactPhoneNumber: '416-555-0100', contactRelationship: 'parent', discoverySource: 'online',
      notes: 'Follow up next week', status: 'converted', createdAt: new Date().toISOString(),
      statusUpdatedAt: new Date().toISOString(), suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    };
    renderPage(queryClient);
    await screen.findByRole('row', { name: /Avery Interest/ });
    getExpressions.mockResolvedValue([convertedSubmission]);

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Interest' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Convert to Lead' }));

    await waitFor(() => expect(convertExpression).toHaveBeenCalledWith('expression-1'));
    expect(await screen.findByText('Converted')).toBeInTheDocument();
    expect(getExpressions).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['leads', 'list'] });
    expect(screen.getByRole('table', { name: 'Expressions of interest' })).toBeInTheDocument();
  });

  it('reconciles an already-converted submission and shows the conflict as an error', async () => {
    const baseSubmission = {
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School', submittedByRole: 'parent', contactPhoneNumber: '416-555-0100',
      contactRelationship: 'parent', discoverySource: 'online', notes: 'Follow up next week',
      createdAt: new Date().toISOString(), statusUpdatedAt: new Date().toISOString(),
      suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    } as const;
    getExpressions
      .mockResolvedValueOnce([{ ...baseSubmission, status: 'reviewed' }])
      .mockResolvedValueOnce([{ ...baseSubmission, status: 'converted' }]);
    convertExpression.mockRejectedValueOnce(new Error('This expression of interest has already been converted'));
    renderPage();
    await screen.findByRole('row', { name: /Avery Interest/ });

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Avery Interest' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Convert to Lead' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already been converted');
    expect(await screen.findByText('Converted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions for Avery Interest' })).not.toBeInTheDocument();
  });

  it('keeps signed-up submissions terminal in the table', async () => {
    getExpressions.mockResolvedValueOnce([{
      id: 'expression-1', youthFirstName: 'Avery', youthLastName: 'Interest', age: 14,
      school: 'Test School', submittedByRole: 'parent', contactPhoneNumber: '416-555-0100',
      contactRelationship: 'parent', discoverySource: 'online', notes: null, status: 'signed_up',
      createdAt: new Date().toISOString(), statusUpdatedAt: new Date().toISOString(),
      suggestedProgramId: 'program-1', suggestedProgramName: 'Soft Skills',
    }]);

    renderPage();

    expect(await screen.findByText('Signed Up')).toBeInTheDocument();
    expect(screen.queryByRole('button', {
      name: 'More actions for Avery Interest',
    })).not.toBeInTheDocument();
  });

  it('requests expressions filtered by inferred program', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Avery Interest/ });

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
