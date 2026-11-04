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
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useSessionTableData', () => ({ useSessionTableData }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock sessions table" />;
  },
}));

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
    tableProps.current = null;
  });

  it('wires filters and remote state into the table', () => {
    render(<SessionTable {...baseProps} filters={{ cycleIds: ['cycle-1'] }} />);

    expect(useSessionTableData).toHaveBeenCalledWith(
      baseProps.queryKey, { cycleIds: ['cycle-1'] }, baseProps.sorting, true,
    );
  });

  it('retains the selected row after a refresh failure', async () => {
    tableState.sessions = [session];
    tableState.error = 'Could not load sessions';
    render(<SessionTable {...baseProps} selectedSessionId="session-1" />);

    await waitFor(() => expect(baseProps.onSelectedSessionResolved).toHaveBeenCalledWith(session));
    expect(tableProps.current).toEqual(expect.objectContaining({
      selectedKey: 'session-1', scrollToSelected: true,
      unavailable: undefined,
    }));
    expect(baseProps.onMessageChange).toHaveBeenLastCalledWith({
      message: 'Could not load sessions',
      action: { label: 'Retry', onClick: tableState.retry },
    });
  });

  it('keeps the initial failure unavailable when no rows were loaded', () => {
    tableState.error = 'Could not load sessions';
    render(<SessionTable {...baseProps} />);

    expect(tableProps.current).toEqual(expect.objectContaining({
      unavailable: { title: 'Sessions unavailable', onRetry: tableState.retry },
    }));
  });

});
