// Scope: verifies session-list query wiring, table states, selection resolution, and pagination contract.
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CohortSession } from '../../../../../common/types/cohort';
import { makeCohortSession } from '../../../../../tests/factories/session';
import SessionListView from './SessionListView';

const session = makeCohortSession();
const listState = vi.hoisted(() => ({
  sessions: [] as CohortSession[], loading: false, refreshing: false, error: '',
  hasNextPage: false, loadingNextPage: false, loadNextPage: vi.fn(),
}));
const useSessions = vi.hoisted(() => vi.fn(() => listState));
const tableProps = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock('./hooks/useSessions', () => ({ useSessions }));
vi.mock('../../../../../common/components/Table/Table', () => ({
  default: (props: Record<string, unknown>) => {
    tableProps.current = props;
    return <div aria-label="Mock sessions table" />;
  },
}));

const baseProps = {
  queryKey: ['sessions', 'list'] as const,
  columns: [], hiddenColumnKeys: [], filters: {},
  sorting: { key: 'date' as const, direction: 'desc' as const }, columnWidths: {}, selectedSessionId: '',
  onSessionSelect: vi.fn(), onSortingChange: vi.fn(), onColumnWidthsChange: vi.fn(),
  onSelectedSessionResolved: vi.fn(),
};

describe('SessionListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(listState, {
      sessions: [], loading: false, refreshing: false, error: '',
      hasNextPage: false, loadingNextPage: false,
    });
    tableProps.current = null;
  });

  it('wires filters and list state into the table', () => {
    render(<SessionListView {...baseProps} filters={{ statuses: ['completed'] }} />);

    expect(useSessions).toHaveBeenCalledWith(
      baseProps.queryKey, { statuses: ['completed'] }, baseProps.sorting, true,
    );
    expect(tableProps.current).toEqual(expect.objectContaining({
      ariaLabel: 'Sessions', emptyMessage: 'No sessions match your search and filters',
      sorting: baseProps.sorting,
    }));
  });

  it('resolves the selected row and distinguishes unfiltered failures', async () => {
    listState.sessions = [session];
    listState.error = 'Could not load sessions';
    render(<SessionListView {...baseProps} selectedSessionId="session-1" />);

    await waitFor(() => expect(baseProps.onSelectedSessionResolved).toHaveBeenCalledWith(session));
    expect(tableProps.current).toEqual(expect.objectContaining({
      selectedKey: 'session-1', scrollToSelected: true, emptyMessage: 'No sessions yet',
      error: 'Could not load sessions',
    }));
  });
});
