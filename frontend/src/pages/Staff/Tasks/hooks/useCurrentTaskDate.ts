import { useEffect, useState } from 'react';

import { getDateKeyInTimeZone } from '../../../../common/utils/date';

const DATE_REFRESH_INTERVAL = 60_000;

export default function useCurrentTaskDate() {
  const [today, setToday] = useState(() => getDateKeyInTimeZone(
    new Date(),
    'America/Toronto',
  ));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setToday(current => {
        const next = getDateKeyInTimeZone(new Date(), 'America/Toronto');
        return next === current ? current : next;
      });
    }, DATE_REFRESH_INTERVAL);

    return () => window.clearInterval(interval);
  }, []);

  return today;
}
