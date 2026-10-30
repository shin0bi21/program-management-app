import Label from '../../../../../common/components/Label/Label';
import type { HoursItem } from '../../types';
import { getHoursEntryType, HOURS_ENTRY_TYPE_LABELS } from '../../utils/hoursEntryType';
import './HoursTypeLabel.css';

export default function HoursTypeLabel({ item }: { item: HoursItem }) {
  const type = getHoursEntryType(item);
  const label = HOURS_ENTRY_TYPE_LABELS[type];
  return <Label className={`hours-item__type ${type === 'other' ? 'regular' : type}`}>{label}</Label>;
}
