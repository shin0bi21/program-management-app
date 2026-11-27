import type { ReactElement } from 'react';
import Label from '../../../../../common/components/Label/Label';
import type { Hours } from '../../types';
import { HOURS_ITEM_TYPE_LABELS } from '../../utils/hoursItemType';
import './HoursTypeLabel.css';

interface HoursTypeLabelProps {
  item: Pick<Hours, 'type'>;
}

/**
 * Displays the source label for an Hours entry.
 * @example <HoursTypeLabel item={entry} /> // Task, Session, or Regular
 */
export default function HoursTypeLabel({ item }: HoursTypeLabelProps): ReactElement {
  const type = item.type;
  const label = HOURS_ITEM_TYPE_LABELS[type];
  return <Label className={`hours-item__type ${type}`}>{label}</Label>;
}
