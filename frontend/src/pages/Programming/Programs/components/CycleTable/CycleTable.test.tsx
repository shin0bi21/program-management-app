import { act, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithQueryClient } from '../../../../../tests/queryClientTestUtils';
import { getCycleList } from '../../api/cycles.api';
import { replaceInfiniteListRow } from '../../../../../query/infiniteListCache';
import { CYCLE_TABLE_QUERY_KEY } from './queryKeys';
import CycleTable from './CycleTable';
import type { ProgramCycle } from '../../../../../common/features/programming/cycles/types';

vi.mock('../../api/cycles.api', () => ({ getCycleList: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

it('loads cycles through the table-owned cursor query', async () => {
  const cycle = { id: 'cycle-1', name: 'Summer', startsOn: '2026-07-01', endsOn: '2026-08-01', state: 'active' as const };
  vi.mocked(getCycleList).mockResolvedValue({ rows: [cycle], nextCursor: null });

  renderWithQueryClient(<CycleTable isOpen enabled onClose={vi.fn()} onAdd={vi.fn()} columns={[{ id: 'name', header: 'Cycle', accessorFn: item => item.name }]} />);

  expect(await screen.findByText('Summer')).toBeInTheDocument();
  expect(getCycleList).toHaveBeenCalledWith({ key: 'startsOn', direction: 'desc', limit: 50, cursor: undefined }, { signal: expect.any(AbortSignal) });
});

it('keeps the query mounted through child dialogs without fetching before the management session', async () => {
  const cycle = { id: 'cycle-1', name: 'Summer', startsOn: '2026-07-01', endsOn: '2026-08-01', state: 'active' as const };
  vi.mocked(getCycleList).mockResolvedValue({ rows: [cycle], nextCursor: null });
  const props = { columns: [{ id: 'name', header: 'Cycle', accessorFn: (item: ProgramCycle) => item.name }], onClose: vi.fn(), onAdd: vi.fn() };
  const view = renderWithQueryClient(<CycleTable {...props} isOpen={false} enabled={false} />);
  expect(getCycleList).not.toHaveBeenCalled();

  view.rerender(<CycleTable {...props} isOpen enabled />);
  expect(await screen.findByText('Summer')).toBeInTheDocument();
  view.rerender(<CycleTable {...props} isOpen={false} enabled />);
  act(() => replaceInfiniteListRow(view.queryClient, CYCLE_TABLE_QUERY_KEY, { ...cycle, name: 'Renamed Summer' }));
  view.rerender(<CycleTable {...props} isOpen enabled />);

  expect(await screen.findByText('Renamed Summer')).toBeInTheDocument();
  expect(getCycleList).toHaveBeenCalledOnce();
});
