import { useEffect, useState } from 'react';
import { getPrograms } from '../api/programs.api';
import type { Program } from '../types/program';
import { getErrorMessage } from '../utils/clientErrors';

export function usePrograms() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPrograms()
      .then(data => { if (active) setPrograms(data); })
      .catch(err => { if (active) setError(getErrorMessage(err, 'Failed to load programs')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { programs, setPrograms, loading, error };
}
