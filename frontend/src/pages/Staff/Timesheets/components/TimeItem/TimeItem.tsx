import CalendarItem from '../../../../../common/components/ResourceCalendar/components/CalendarItem';
import type { TimesheetItem } from '../../../../../common/features/timeEntries/types';

interface TimeItemProps {
  item: TimesheetItem;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TimeItem({ item, onEdit, onDelete }: TimeItemProps) {
  return <CalendarItem
    id={item.id}
    ariaLabel={`${item.taskTitle ?? item.categoryLabel}, ${item.hours} hours`}
    leading={`${item.hours}h`}
    summary={<>{item.taskTitle ?? item.categoryLabel} · {item.programName ?? 'General'}</>}
    detailTitle={item.taskTitle ?? item.categoryLabel}
    details={[
      ...(item.programName ? [{ label: 'Program', value: item.programName }] : []),
      ...(item.cycleName ? [{ label: 'Cycle', value: item.cycleName }] : []),
      { label: 'Category', value: item.categoryLabel },
      { label: 'Hours', value: item.hours },
      { label: 'Notes', value: item.note, multiline: true },
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
  />;
}
