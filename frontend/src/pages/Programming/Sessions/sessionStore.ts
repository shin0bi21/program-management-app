import { createRecordStore } from '../../../query/createRecordStore';
import type { ListSort } from '../../../common/components/Table/Table.types';
import type { ProgramSession, SessionSortKey } from './types';

/**
 * Supplies server-compatible text or timestamp instants for the selected session order.
 * @example getSessionSortValue(session, 'date') // Date representing startsAt
 */
export function getSessionSortValue(session: ProgramSession, key: SessionSortKey) {
  return {
    program: session.program.toLowerCase(),
    cycle: session.cycle.toLowerCase(),
    theme: session.theme.toLowerCase(),
    date: new Date(session.startsAt),
    time: new Date(session.startsAt),
    type: session.sessionType.toLowerCase(),
    status: session.state,
  }[key];
}

export const sessionStore = createRecordStore<ProgramSession>({
  queryKey: ['sessions', 'records'],
  listKey: ['sessions', 'table'],
  getSortValue: (session, queryKey) => {
    const sorting = queryKey[queryKey.length - 1] as ListSort<SessionSortKey>;
    return getSessionSortValue(session, sorting.key);
  },
});
