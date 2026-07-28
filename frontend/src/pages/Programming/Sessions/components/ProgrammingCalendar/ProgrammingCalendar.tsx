import { useEffect, useRef, useState } from 'react';
import FullCalendar, { type CalendarRef, type DatesSetInfo, type EventInput } from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/react/daygrid';
import listPlugin from '@fullcalendar/react/list';
import timeGridPlugin from '@fullcalendar/react/timegrid';
import classicThemePlugin from '@fullcalendar/react/themes/classic';
import '@fullcalendar/react/skeleton.css';
import '@fullcalendar/react/themes/classic/theme.css';
import '@fullcalendar/react/themes/classic/palette.css';
import { sessionTypeModifier } from '../../utils/sessionType';
import './ProgrammingCalendar.css';

interface ProgrammingCalendarProps {
  events?: EventInput[];
  onDatesSet?: (range: DatesSetInfo) => void;
  onEventSelect?: (eventId: string) => void;
}

const calendarPlugins = [
  classicThemePlugin,
  dayGridPlugin,
  timeGridPlugin,
  listPlugin,
];

const mobileCalendarQuery = '(max-width: 1000px)';

const isMobileCalendar = () => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(mobileCalendarQuery).matches;
  }
  return window.innerWidth <= 1000;
};

function useMobileCalendar() {
  const [mobile, setMobile] = useState(isMobileCalendar);

  useEffect(() => {
    if (typeof window.matchMedia === 'function') {
      const media = window.matchMedia(mobileCalendarQuery);
      const update = (event: MediaQueryListEvent) => setMobile(event.matches);
      setMobile(media.matches);
      media.addEventListener('change', update);
      return () => media.removeEventListener('change', update);
    }

    const update = () => setMobile(isMobileCalendar());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return mobile;
}

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
  const mobile = useMobileCalendar();
  const calendarRef = useRef<CalendarRef | null>(null);

  useEffect(() => {
    if (mobile) calendarRef.current?.getApi().changeView('timeGridDay');
  }, [mobile]);

  return (
    <section className="programming-calendar" aria-label="Programming calendar">
      <FullCalendar
        ref={calendarRef}
        plugins={calendarPlugins}
        initialView={mobile ? 'timeGridDay' : 'dayGridMonth'}
        headerToolbar={{
          start: 'prev,next today',
          center: 'title',
          end: mobile
            ? 'timeGridDay,listMonth'
            : 'dayGridMonth,timeGridWeek,timeGridDay,listMonth',
        }}
        events={events}
        eventInteractive={Boolean(onEventSelect)}
        eventClick={info => onEventSelect?.(info.event.id)}
        displayEventTime={false}
        eventContent={info => {
          const programName = info.event.extendedProps.programName as string | undefined;
          const sessionTypeName = info.event.extendedProps.sessionTypeName as string | undefined;
          const timeRange = compactTimeRange(info.event.start, info.event.end);
          return (
            <span
              className="programming-calendar-event"
              aria-label={[programName, info.event.title, sessionTypeName, timeRange].filter(Boolean).join(', ')}
            >
              {programName && <span className="programming-calendar-event__program">{programName}</span>}
              <span className="programming-calendar-event__session-line">
                {info.event.title && (
                  <span className="programming-calendar-event__session">{info.event.title}</span>
                )}
                {sessionTypeName && (
                  <span
                    className={
                      `programming-calendar-event__type `
                      + `programming-calendar-event__type--${sessionTypeModifier(sessionTypeName)}`
                    }
                  >
                    {sessionTypeName}
                  </span>
                )}
              </span>
              <span className="programming-calendar-event__time">{timeRange}</span>
            </span>
          );
        }}
        nowIndicator
        dayMaxEvents={1}
        expandRows
        height="100%"
        noEventsText="No sessions scheduled for this period."
        datesSet={onDatesSet}
      />
    </section>
  );
}
