import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import StatusLabel from '../../../../../../common/components/StatusLabel/StatusLabel';
import SessionTypeLabel from '../../SessionTypeLabel/SessionTypeLabel';
import type { ProgramSession } from '../../../types';
import './SessionItem.css';

const statusLabels = { upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled' } as const;

/**
 * Displays a session theme with type/status badges in details and a full schedule in its accessible name.
 * @param props.session - Session with valid, ordered start/end timestamps and program/cycle names.
 * @param props.timezone - Intl-supported program timezone for details and accessible text; defaults to Toronto.
 * @param props.calendar - Placement and interaction callbacks supplied by TimelineCalendar.
 * @example An overnight session shows both local dates in its details while its theme stays concise.
 */
export default function SessionItem<TRow, TItemData>({
  calendar,
  session,
  timezone = 'America/Toronto',
  selected = false,
  onEdit,
  onDelete,
}: {
  calendar?: ItemCalendarProps<TRow, TItemData>;
  session: ProgramSession;
  timezone?: string;
  selected?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const dateTimeFormatter = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone });
  const startsAt = dateTimeFormatter.format(new Date(session.startsAt));
  const endsAt = dateTimeFormatter.format(new Date(session.endsAt));
  const dateRange = formatSessionDateRange(session.startsAt, session.endsAt, timezone);
  const status = statusLabels[session.state];

  return <Item
    calendar={calendar}
    id={session.id}
    selected={selected}
    ariaLabel={`${session.theme}, ${session.programName}, ${session.cycleName}, ${session.sessionType}, ${startsAt} to ${endsAt}, ${status}`}
    summary={session.theme}
    detailTitle={<span className="session-item__detail-title">
      <span>{session.theme}</span>
      <span className="session-item__detail-badges">
        <SessionTypeLabel name={session.sessionType} appearance="calendar" />
        <StatusLabel status={session.state} label={status} />
      </span>
    </span>}
    details={[
      { label: 'Program', value: session.programName },
      { label: 'Cycle', value: session.cycleName },
      { label: 'Date', value: dateRange, sectionStart: true },
      ...(session.description ? [{ label: 'Description', value: session.description, multiline: true }] : []),
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
    className={`session-item--${session.state}`}
  />;
}

/**
 * Formats a session's local dates and times, showing both dates when it runs overnight.
 * @param start - Valid session start timestamp.
 * @param end - Valid session end timestamp, no earlier than start.
 * @param timezone - Intl-supported program timezone, such as America/Toronto.
 * @returns Local date/time range with whole-hour minutes omitted; locale spacing may vary.
 * @example formatSessionDateRange('2026-12-22T04:00:00Z', '2026-12-22T06:30:00Z', 'America/Toronto')
 * // "Dec 21, 11 p.m. – Dec 22, 1:30 a.m." (locale spacing varies).
 */
function formatSessionDateRange(start: string, end: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone,
  });

  return formatter.formatRange(new Date(start), new Date(end)).replace(/:00\b/g, '');
}
