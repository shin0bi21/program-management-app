import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ProgramTable from './ProgramTable';
import useProgramTableData from './hooks/useProgramTableData';

vi.mock('./hooks/useProgramTableData', () => ({ default: vi.fn() }));
const program = { id: 'program-1', name: 'Skills', description: '', enrollmentRequired: false, minAge: null, maxAge: null, defaultDayOfWeek: 'tuesday' as const, defaultStartTime: '17:00', defaultEndTime: '19:30', timezone: 'America/Toronto' as const };
const columns = [{ id: 'name', header: 'Program', accessorFn: (item: typeof program) => item.name }];
const queryKey = ['programs', 'table'];
const filters = { assignedOnly: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useProgramTableData).mockReturnValue({
    rows: [program], loading: false, refreshing: false, error: '', nextPageError: '',
    retry: vi.fn(), retryNextPage: vi.fn(), hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  });
});

it('passes its scope to the data owner and preserves selected program wiring', () => {
  const onProgramSelect = vi.fn();
  render(<ProgramTable queryKey={queryKey} filters={filters} columns={columns}
    selectedProgramId={program.id} onProgramSelect={onProgramSelect} />);

  expect(useProgramTableData).toHaveBeenCalledWith(queryKey, filters);
  fireEvent.click(screen.getByText('Skills'));

  expect(onProgramSelect).toHaveBeenCalledWith(program);
});

it('reports initial query failures and retries through the table unavailable state', () => {
  const retry = vi.fn();
  const onMessageChange = vi.fn();
  vi.mocked(useProgramTableData).mockReturnValue({
    ...vi.mocked(useProgramTableData)(queryKey, filters), rows: [], error: 'Could not load programs', retry,
  });
  render(<ProgramTable queryKey={queryKey} filters={filters} columns={columns} onMessageChange={onMessageChange} />);

  expect(screen.getByText('Programs unavailable')).toBeInTheDocument();
  expect(screen.queryByText('No programs yet')).not.toBeInTheDocument();
  expect(onMessageChange).toHaveBeenCalledWith({ message: 'Could not load programs', action: { label: 'Retry', onClick: retry } });

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(retry).toHaveBeenCalledOnce();
});

it('keeps loaded rows and reports next-page failure with the matching retry', () => {
  const retryNextPage = vi.fn();
  const onMessageChange = vi.fn();
  vi.mocked(useProgramTableData).mockReturnValue({
    ...vi.mocked(useProgramTableData)(queryKey, filters), nextPageError: 'Next programs unavailable', retryNextPage,
  });
  render(<ProgramTable queryKey={queryKey} filters={filters} columns={columns} onMessageChange={onMessageChange} />);

  expect(screen.getByText('Skills')).toBeInTheDocument();
  expect(onMessageChange).toHaveBeenCalledWith({ message: 'Next programs unavailable', action: { label: 'Retry', onClick: retryNextPage } });

  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

  expect(retryNextPage).toHaveBeenCalledOnce();
});
