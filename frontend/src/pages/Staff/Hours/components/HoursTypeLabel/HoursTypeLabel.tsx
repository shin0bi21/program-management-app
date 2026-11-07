import Label from '../../../../../common/components/Label/Label';
import type { HoursItem } from '../../types';
import { HOURS_ITEM_TYPE_LABELS } from '../../utils/hoursItemType';
import './HoursTypeLabel.css';

/**
 * Displays the source label for an Hours entry.
 * @example <HoursTypeLabel item={entry} /> // Task, Session, or Regular
 */
export default function HoursTypeLabel({ item }: { item: HoursItem }) {
  const type = item.type;
  const label = HOURS_ITEM_TYPE_LABELS[type];
  return <Label className={`hours-item__type ${type}`}>{label}</Label>;
}
