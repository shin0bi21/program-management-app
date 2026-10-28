import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import type { HoursItem } from '../../../types';
import HoursTypeLabel from '../../HoursTypeLabel/HoursTypeLabel';
import { getHoursEntryType, HOURS_ENTRY_TYPE_LABELS } from '../../../utils/hoursEntryType';
import './HoursItem.css';

interface HoursItemProps<TRow, TItemData> {
  calendar?: ItemCalendarProps<TRow, TItemData>;
  item: HoursItem;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function HoursItem<TRow, TItemData>({ calendar, item, onEdit, onDelete }: HoursItemProps<TRow, TItemData>) {
  const type = getHoursEntryType(item);
  const label = HOURS_ENTRY_TYPE_LABELS[type];
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
      { label: 'Program', value: item.programName ?? '—' },
      { label: 'Category', value: item.categoryLabel },
      { label: 'Hours', value: item.hours, sectionStart: true },
      { label: 'Notes', value: item.note, multiline: true },
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
  />;
}
