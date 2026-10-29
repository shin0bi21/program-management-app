import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
import StatusBadge from '../../../../../../common/components/StatusBadge/StatusBadge';
import SessionTypeBadge from '../../SessionTypeBadge/SessionTypeBadge';
import type { CohortSession } from '../../../types';
import './SessionItem.css';

const statusLabels = { upcoming: 'Upcoming', completed: 'Completed', cancelled: 'Cancelled' } as const;

export default function SessionItem<TRow, TItemData>({ calendar, session, timezone = 'America/Toronto', selected = false, onEdit, onDelete }: {
  calendar?: ItemCalendarProps<TRow, TItemData>;
  session: CohortSession;
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
    ariaLabel={`${session.theme}, ${session.programName}, ${session.cohortName}, ${session.sessionTypeName}, ${startsAt} to ${endsAt}, ${status}`}
    summary={session.theme}
    detailTitle={<span className="session-item__detail-title">
      <span>{session.theme}</span>
      <span className="session-item__detail-badges">
        <SessionTypeBadge name={session.sessionTypeName} appearance="calendar" />
        <StatusBadge status={session.state} label={status} />
      </span>
    </span>}
    details={[
      { label: 'Program', value: session.programName },
      { label: 'Cohort', value: session.cohortName },
      { label: 'Date', value: dateRange, sectionStart: true },
      ...(session.description ? [{ label: 'Description', value: session.description, multiline: true }] : []),
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
    className={`session-item--${session.state}`}
  />;
}

/**
 * Formats a compact local schedule, retaining both dates for an overnight session.
 * Requires: start and end are valid ordered timestamps and timezone is supported by Intl.
 * Example: Dec 21 at 17:00–19:30 in Toronto => "Dec 21, 5–7:30 p.m." (locale spacing varies).
 */
function formatSessionDateRange(start: string, end: string, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone,
  });

  return formatter.formatRange(new Date(start), new Date(end)).replace(/:00\b/g, '');
}
