import FullCalendar, { type DatesSetInfo, type EventInput } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import listPlugin from '@fullcalendar/react/list';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import './ProgrammingCalendar.css';

interface ProgrammingCalendarProps {
  events?: EventInput[];
  onDatesSet?: (range: DatesSetInfo) => void;
  onEventSelect?: (eventId: string) => void;
}

const calendarPlugins = [
  classicThemePlugin,
  dayGridPlugin,
  listPlugin,
];

const eventTimeFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const compactTime = (date: Date | null) => {
  if (!date) return '';
  const parts = Object.fromEntries(
    eventTimeFormatter.formatToParts(date).map(part => [part.type, part.value]),
  );
  const minutes = parts.minute === '00' ? '' : `:${parts.minute}`;
  const period = (parts.dayPeriod ?? '').toLowerCase().replace(/[\s.]/g, '');
  return `${parts.hour}${minutes}${period}`;
};

const compactTimeRange = (start: Date | null, end: Date | null) => {
  const startTime = compactTime(start);
  const endTime = compactTime(end);
  return endTime ? `${startTime} – ${endTime}` : startTime;
};

export default function ProgrammingCalendar({
  events = [],
  onDatesSet,
  onEventSelect,
}: ProgrammingCalendarProps) {
  return (
    <section className="programming-calendar" aria-label="Programming calendar">
      <FullCalendar
        plugins={calendarPlugins}
        initialView="dayGridMonth"
        headerToolbar={{
          start: 'prev,next today',
          center: 'title',
          end: 'dayGridMonth,listMonth',
        }}
        events={events}
        eventInteractive={Boolean(onEventSelect)}
        eventClick={info => onEventSelect?.(info.event.id)}
        displayEventTime={false}
        eventContent={info => {
          const description = info.event.extendedProps.description as string | null | undefined;
          const timeRange = compactTimeRange(info.event.start, info.event.end);
          return (
            <span
              className="programming-calendar-event"
              aria-label={[info.event.title, description, timeRange].filter(Boolean).join(', ')}
            >
              <span className="programming-calendar-event__activity">{info.event.title}</span>
              {description && <span className="programming-calendar-event__description">{description}</span>}
              <span className="programming-calendar-event__time">{timeRange}</span>
            </span>
          );
        }}
        nowIndicator
        dayMaxEvents
        expandRows
        height="100%"
        noEventsText="No sessions scheduled for this period."
        datesSet={onDatesSet}
      />
    </section>
  );
}
