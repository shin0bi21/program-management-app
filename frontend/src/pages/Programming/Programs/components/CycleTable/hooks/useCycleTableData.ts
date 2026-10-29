import { TABLE_PAGE_SIZE } from '../../../../../../query/types';
import useInfiniteListQuery from '../../../../../../query/hooks/useInfiniteListQuery';
import type { ProgramCycle } from '../../../../../../common/features/programming/cycles/types';
import { getCycleList } from '../../../api/cycles.api';

import { CYCLE_TABLE_QUERY_KEY } from '../queryKeys';

export default function useCycleTableData(enabled: boolean) {
  return useInfiniteListQuery<ProgramCycle>({
    enabled,
    ordering: { getValue: cycle => cycle.startsOn, direction: 'desc' },
    queryKey: [...CYCLE_TABLE_QUERY_KEY, { key: 'startsOn', direction: 'desc' }],
    queryFn: ({ signal, pageParam }) => getCycleList({
      key: 'startsOn', direction: 'desc', cursor: pageParam ?? undefined, limit: TABLE_PAGE_SIZE,
    }, { signal }),
    errorMessage: 'Could not load cycles',
  });
}
