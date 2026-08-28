import { useEffect, useRef, useState } from 'react';
import type { CalendarRef } from '@fullcalendar/react';

const mobileCalendarQuery = '(max-width: 1000px)';

const isMobileCalendar = () => {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia === 'function') return window.matchMedia(mobileCalendarQuery).matches;
  return window.innerWidth <= 1000;
};

export function useProgrammingCalendar() {
  const [mobile, setMobile] = useState(isMobileCalendar);
  const calendarRef = useRef<CalendarRef | null>(null);

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

  useEffect(() => {
    calendarRef.current?.getApi().changeView(mobile ? 'timeGridDay' : 'dayGridMonth');
  }, [mobile]);

  return { mobile, calendarRef };
}
