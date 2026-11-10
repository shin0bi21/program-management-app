import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import StatusLabel from '../../../../../../common/components/StatusLabel/StatusLabel';
import SessionTypeLabel from '../../SessionTypeLabel/SessionTypeLabel';
import type { ProgramSession } from '../../../types';
import { formatShortDate } from '../../../../../../common/utils/date';
import { formatSessionTime } from '../../../utils/sessionSchedule';
import './SessionItem.css';

const statusLabels = { upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled' } as const;

/**
 * Displays a session theme with type/status badges in details and a full schedule in its accessible name.
 * @param props.session - Session with one date and ordered clock times and program/cycle names.
 * @param props.calendar - Placement and interaction callbacks supplied by TimelineCalendar.
 * @example A session on August 10 at 17:00 shows that saved date and start time.
 */
export default function SessionItem<TRow, TItemData>({
  calendar,
  session,
  selected = false,
  onEdit,
  onDelete,
}: {
  calendar?: ItemCalendarProps<TRow, TItemData>;
  session: ProgramSession;
  selected?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const date = formatShortDate(session.date);
  const startTime = formatSessionTime(session.startTime);
  const endTime = formatSessionTime(session.endTime);
  const status = statusLabels[session.state];

  return <Item
    calendar={calendar}
    id={session.id}
    selected={selected}
    ariaLabel={`${session.theme}, ${session.program}, ${session.cycle}, ${session.sessionType}, ${date}, ${startTime} to ${endTime}, ${status}`}
    summary={session.theme}
    detailTitle={<span className="session-item__detail-title">
      <span>{session.theme}</span>
      <span className="session-item__detail-badges">
        <SessionTypeLabel name={session.sessionType} appearance="calendar" />
        <StatusLabel status={session.state} label={status} />
      </span>
    </span>}
    details={[
      { label: 'Program', value: session.program },
      { label: 'Cycle', value: session.cycle },
      { label: 'Date', value: date, sectionStart: true },
      { label: 'Time', value: `${startTime} – ${endTime}` },
      ...(session.description ? [{ label: 'Description', value: session.description, multiline: true }] : []),
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
    className={`session-item--${session.state}`}
  />;
}
