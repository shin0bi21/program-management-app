import { render } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ProgramTable from './ProgramTable';
import useProgramTableData from './hooks/useProgramTableData';

vi.mock('./hooks/useProgramTableData', () => ({ default: vi.fn() }));
vi.mock('../../../../../common/components/Table/Table', () => ({ default: () => null }));
const queryKey = ['programs', 'table'];
const filters = { assignedOnly: true };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useProgramTableData).mockReturnValue({
    rows: [], loading: false, refreshing: false, error: '', nextPageError: '',
    retry: vi.fn(), retryNextPage: vi.fn(), hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  });
});

it('maps initial query failure recovery to the page message', () => {
  const retry = vi.fn();
  const onMessageChange = vi.fn();
  vi.mocked(useProgramTableData).mockReturnValue({
    ...vi.mocked(useProgramTableData)(queryKey, filters), rows: [], error: 'Could not load programs', retry,
  });
  render(<ProgramTable queryKey={queryKey} filters={filters} columns={[]} onMessageChange={onMessageChange} />);

  expect(onMessageChange).toHaveBeenCalledWith({ message: 'Could not load programs', action: { label: 'Retry', onClick: retry } });
});

it('maps next-page failure recovery to the page message', () => {
  const retryNextPage = vi.fn();
  const onMessageChange = vi.fn();
  vi.mocked(useProgramTableData).mockReturnValue({
    ...vi.mocked(useProgramTableData)(queryKey, filters), nextPageError: 'Next programs unavailable', retryNextPage,
  });
  render(<ProgramTable queryKey={queryKey} filters={filters} columns={[]} onMessageChange={onMessageChange} />);

  expect(onMessageChange).toHaveBeenCalledWith({ message: 'Next programs unavailable', action: { label: 'Retry', onClick: retryNextPage } });
});
