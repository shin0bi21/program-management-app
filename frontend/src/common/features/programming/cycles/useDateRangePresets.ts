import { getDateKeyInTimeZone } from '../../../utils/date';
import { useCycleReferences } from '../../referenceData/hooks/useReferenceData';
import { getDateRangePresets } from './dateRangePresets';

export default function useDateRangePresets() {
  const cycles = useCycleReferences();

  return getDateRangePresets(getDateKeyInTimeZone(), cycles.error ? [] : cycles.rows);
}
