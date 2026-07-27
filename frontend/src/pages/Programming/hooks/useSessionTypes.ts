import { useEffect, useState } from 'react';
import { getSessionTypes } from '../../../common/api/cohorts.api';
import type { SessionType } from '../../../common/types/cohort';

export function useSessionTypes() {
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>([]);

  useEffect(() => {
    let active = true;
    void getSessionTypes()
      .then((types) => {
        if (active) setSessionTypes(types);
      })
      .catch(() => {
        if (active) setSessionTypes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return sessionTypes;
}
