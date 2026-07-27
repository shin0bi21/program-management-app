import { useCallback, useEffect, useState } from 'react';
import { getPublicHomepage, type HomepageContent } from '../api/homepage.api';
import { getErrorMessage } from '../../../common/utils/clientErrors';

export function useHomepageContent() {
  const [content, setContent] = useState<HomepageContent>({ images: [], sessions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContent(await getPublicHomepage());
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { content, loading, error, refresh: load };
}
