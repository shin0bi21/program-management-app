import CalendarItem from '../../../../../../common/components/ResourceCalendar/items/CalendarItem';
import type { HoursItem } from '../../../types';
import HoursTypeLabel from '../../HoursTypeLabel/HoursTypeLabel';
import { getHoursEntryType, HOURS_ENTRY_TYPE_LABELS } from '../../../utils/hoursEntryType';
import './HoursItem.css';

interface HoursItemProps {
  item: HoursItem;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function HoursItem({ item, onEdit, onDelete }: HoursItemProps) {
  const type = getHoursEntryType(item);
  const label = HOURS_ENTRY_TYPE_LABELS[type];
  const title = item.taskTitle ?? item.sessionLabel ?? item.categoryLabel;
  return <CalendarItem
    id={item.id}
    className="hours-item"
    ariaLabel={`${title}, ${item.hours} hours, ${label}`}
    leading={`${item.hours}h`}
    summary={<HoursTypeLabel item={item} />}
    detailTitle={title}
    details={[
      { label: 'Cycle', value: item.cycleName ?? '—' },
      { label: 'Program', value: item.programName ?? '—' },
      { label: 'Category', value: item.categoryLabel },
      { label: 'Hours', value: item.hours, sectionStart: true },
      { label: 'Notes', value: item.note, multiline: true },
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
  />;
}
