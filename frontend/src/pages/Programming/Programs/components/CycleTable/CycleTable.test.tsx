import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getCycleList } from '../../api/cycles.api';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import { CYCLE_TABLE_QUERY_KEY } from './queryKeys';
import CycleTable from './CycleTable';

vi.mock('../../api/cycles.api', () => ({ getCycleList: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('keeps the query mounted through child dialogs without fetching before the management session', async () => {
  const cycle = { id: 'cycle-1', title: 'Summer', startsOn: '2026-07-01', endsOn: '2026-08-01', state: 'active' as const };
  vi.mocked(getCycleList).mockResolvedValue({ rows: [cycle], nextCursor: null });
  const props = { onEdit: vi.fn(), onDelete: vi.fn(), onClose: vi.fn(), onAdd: vi.fn() };
  const view = renderWithQueryClient(<CycleTable {...props} isOpen={false} enabled={false} />);
  expect(getCycleList).not.toHaveBeenCalled();

  view.rerender(<CycleTable {...props} isOpen enabled />);
  expect(await screen.findByText('Summer')).toBeInTheDocument();
  view.rerender(<CycleTable {...props} isOpen={false} enabled />);
  act(() => replaceInfiniteListRow(view.queryClient, CYCLE_TABLE_QUERY_KEY, { ...cycle, title: 'Renamed Summer' }));
  view.rerender(<CycleTable {...props} isOpen enabled />);

  expect(await screen.findByText('Renamed Summer')).toBeInTheDocument();
  expect(getCycleList).toHaveBeenCalledOnce();
});
