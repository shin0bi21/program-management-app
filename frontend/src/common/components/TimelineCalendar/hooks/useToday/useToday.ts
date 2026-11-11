import { useCallback, useEffect, useState } from 'react';
import { Temporal } from 'temporal-polyfill';
import { getDate } from '../../../../utils/date';

/** Tracks the device-local date across midnight and browser reactivation. @example const { today } = useToday(); */
export function useToday() {
  const [today, setToday] = useState(() => getDate());

  const refreshDate = useCallback(() => {
    const now = getDate();
    setToday(current => current === now ? current : now);
    return now;
  }, []);

  useEffect(() => watchDate(refreshDate), [refreshDate]);

  return { today, refreshDate };
}

/**
 * Schedules date refreshes and returns cleanup for timers and browser listeners.
 * @param refreshDate - Updates the observed local date and returns its YYYY-MM-DD value.
 * @example const stop = watchDate(refreshDate); stop(); // releases all listeners
 */
function watchDate(refreshDate: () => string) {
  let timer: ReturnType<typeof setTimeout>;

  executeRefresh();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', executeRefresh);

  return stopWatchingDate;

  /** Refreshes today and its next deadline. @example Focusing the tab refreshes a stale date. */
  function executeRefresh() {
    refreshDate();
    scheduleRefresh();
  }

  /** Replaces the timer with the next local midnight. @example A DST day may wait 23 or 25 hours. */
  function scheduleRefresh() {
    clearTimeout(timer);
    const now = Temporal.Now.zonedDateTimeISO();
    const midnight = now.add({ days: 1 }).startOfDay();
    timer = setTimeout(executeRefresh, midnight.epochMilliseconds - now.epochMilliseconds);
  }

  /** Refreshes only when the document becomes visible. @example Returning to a hidden tab updates today. */
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') executeRefresh();
  }

  /** Releases this watcher's timer and listeners. @example Effect cleanup stops future refreshes. */
  function stopWatchingDate() {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', executeRefresh);
  }
}
