import type { ItemCalendarProps } from '../../../../../../common/components/TimelineCalendar/types';
import Item from '../../../../../../common/components/TimelineCalendar/components/Item/Item';
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
  const status = statusLabels[session.state];

  return <Item
    calendar={calendar}
    id={session.id}
    selected={selected}
    ariaLabel={`${session.theme}, ${session.programName}, ${session.cohortName}, ${session.sessionTypeName}, ${startsAt} to ${endsAt}, ${status}`}
    summary={session.theme}
    detailTitle={session.theme}
    details={[
      { label: 'Program', value: session.programName },
      { label: 'Cohort', value: session.cohortName },
      { label: 'Type', value: session.sessionTypeName },
      { label: 'Status', value: status },
      { label: 'Starts', value: startsAt, sectionStart: true },
      { label: 'Ends', value: endsAt },
      ...(session.description ? [{ label: 'Description', value: session.description, multiline: true }] : []),
    ]}
    onEdit={onEdit}
    onDelete={onDelete}
    className={`session-item--${session.state}`}
  />;
}
