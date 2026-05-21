import { useState, useEffect } from 'react';
import { getSchools } from '../api/schools.api';
import type { School } from '../types';

export function useSchools() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getSchools()
      .then(data => { setSchools(data); setLoading(false); })
      .catch(err => { if (!controller.signal.aborted) { setError(err.message); setLoading(false); } });
    return () => controller.abort();
  }, []);

  return { schools, setSchools, loading, error };
}
