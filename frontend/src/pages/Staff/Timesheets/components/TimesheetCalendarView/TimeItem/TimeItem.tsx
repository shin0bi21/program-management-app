import CalendarItem from '../../../../../../common/components/ResourceCalendar/components/CalendarItem';
import type { TimesheetItem } from '../../../../../../common/features/timeEntries/types';
import './TimeItem.css';

interface TimeItemProps {
  item: TimesheetItem;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TimeItem({ item, onEdit, onDelete }: TimeItemProps) {
  const entryType = item.taskId ? 'Task' : item.sessionId ? 'Session' : 'Regular';
  const title = item.taskTitle ?? item.sessionLabel ?? item.categoryLabel;
  return <CalendarItem
    id={item.id}
    ariaLabel={`${title}, ${item.hours} hours, ${entryType}`}
    leading={`${item.hours}h`}
    summary={<span className={`time-item__type time-item__type--${entryType.toLowerCase()}`}>{entryType}</span>}
    detailTitle={title}
    details={[
      { label: 'Cycle', value: item.cycleName ?? '—' },
      { label: 'Program', value: item.programName ?? '—' },
      { label: 'Category', value: item.categoryLabel },
      ...(item.sessionLabel ? [{ label: 'Session', value: item.sessionLabel }] : []),
      { label: 'Hours', value: item.hours, sectionStart: true },
      { label: 'Notes', value: item.note, multiline: true },
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
  />;
}
