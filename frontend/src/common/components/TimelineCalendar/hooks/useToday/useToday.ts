import { useCallback, useEffect, useState } from 'react';
import { dayKey } from '../../utils/periods';

export function useToday() {
  const [today, setToday] = useState(() => new Date());

  const refreshDate = useCallback(() => {
    const now = new Date();
    setToday(current => dayKey(current) === dayKey(now) ? current : now);
    return now;
  }, []);

  useEffect(() => watchDate(refreshDate), [refreshDate]);

  return { today, refreshDate };
}

function watchDate(refreshDate: () => Date) {
  let timer: ReturnType<typeof setTimeout>;

  executeRefresh();
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', executeRefresh);

  return stopWatchingDate;

  function executeRefresh() {
    const now = refreshDate();
    scheduleRefresh(now);
  }

  function scheduleRefresh(now: Date) {
    clearTimeout(timer);
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);

    // Local midnight can be less or more than 24 hours away across daylight saving changes.
    timer = setTimeout(executeRefresh, midnight.getTime() - now.getTime());
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') executeRefresh();
  }

  function stopWatchingDate() {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', executeRefresh);
  }
}
