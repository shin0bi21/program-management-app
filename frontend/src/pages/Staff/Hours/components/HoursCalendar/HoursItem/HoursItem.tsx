import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import type { HoursItem as HoursItemData } from '../../../types';
import HoursTypeLabel from '../../HoursTypeLabel/HoursTypeLabel';
import { HOURS_ITEM_TYPE_LABELS } from '../../../utils/hoursItemType';
import './HoursItem.css';

interface HoursItemProps<TRow, TItemData> {
  calendar?: ItemCalendarProps<TRow, TItemData>;
  item: HoursItemData;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Displays an Hours entry and its available actions.
 * @example <HoursItem item={entry} onEdit={openEditor} />
 */
export default function HoursItem<TRow, TItemData>({ calendar, item, onEdit, onDelete }: HoursItemProps<TRow, TItemData>) {
  const type = item.type;
  const label = HOURS_ITEM_TYPE_LABELS[type];
  const title = item.taskTitle ?? item.sessionLabel ?? item.categoryLabel;
  return <Item
    calendar={calendar}
    id={item.id}
    className="hours-item"
    ariaLabel={`${title}, ${item.hours} hours, ${label}`}
    leading={`${item.hours}h`}
    summary={<HoursTypeLabel item={item} />}
    detailTitle={title}
    details={[
      { label: 'Program', value: item.program ?? '—' },
      { label: 'Category', value: item.categoryLabel },
      { label: 'Hours', value: item.hours, sectionStart: true },
      { label: 'Notes', value: item.note, multiline: true },
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
  />;
}
