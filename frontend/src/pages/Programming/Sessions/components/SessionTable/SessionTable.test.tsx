import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProgramSession } from '../../types';
import { makeProgramSession } from '../../../../../tests/factories/session';
import SessionTable from './SessionTable';

const session = makeProgramSession();
const tableState = vi.hoisted(() => ({
  sessions: [] as ProgramSession[], loading: false, refreshing: false, error: '',
  hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
  retry: vi.fn(),
}));
const useSessionTableData = vi.hoisted(() => vi.fn(() => tableState));

vi.mock('./hooks/useSessionTableData', () => ({ useSessionTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({ default: () => null }));

const baseProps = {
  queryKey: ['sessions', 'table'] as const,
  columns: [], hiddenColumnKeys: [], filters: {},
  sorting: { key: 'date' as const, direction: 'desc' as const }, columnWidths: {}, selectedSessionId: '',
  onSessionSelect: vi.fn(), onSortingChange: vi.fn(), onColumnWidthsChange: vi.fn(),
  onSelectedSessionResolved: vi.fn(),
  onMessageChange: vi.fn(),
};

describe('SessionTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(tableState, {
      sessions: [], loading: false, refreshing: false, error: '',
      hasNextPage: false, loadingNextPage: false,
    });
  });

  it('retains the selected row after a refresh failure', async () => {
    tableState.sessions = [session];
    tableState.error = 'Could not load sessions';
    render(<SessionTable {...baseProps} selectedSessionId="session-1" />);

    await waitFor(() => expect(baseProps.onSelectedSessionResolved).toHaveBeenCalledWith(session));
    expect(baseProps.onMessageChange).toHaveBeenLastCalledWith({
      message: 'Could not load sessions',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });
});
