import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../../auth/authContext';
import { getDateKeyInTimeZone } from '../../../utils/date';
import { getProgramCycles } from './cycles.api';
import { getDateRangePresets } from './dateRangePresets';

export default function useDateRangePresets() {
  const { permissions } = useAuth();
  const canReadCycles = permissions.includes('read:programs');
  const { data } = useQuery({
    queryKey: ['program-cycles'],
    enabled: canReadCycles,
    queryFn: ({ signal }) => getProgramCycles({ signal }),
  });

  return getDateRangePresets(getDateKeyInTimeZone(), canReadCycles ? data ?? [] : []);
}
