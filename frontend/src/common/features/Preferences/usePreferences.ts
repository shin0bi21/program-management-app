import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPreference, setPreference, type PreferenceKey } from './preferences.api';
import { normalizePreferences, type PreferenceFields } from './preferences';

interface SaveQueue<T> {
  key: PreferenceKey;
  timer: number | null;
  latest: T | null;
  pending: T | null;
  saving: boolean;
}

interface UsePreferencesOptions<T extends object> {
  key: PreferenceKey;
  fields: PreferenceFields<T>;
  waiting?: boolean;
}

export default function usePreferences<T extends object>({ key, fields, waiting = false }: UsePreferencesOptions<T>) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['user-preference', key] as const, [key]);
  const queue = useMemo<SaveQueue<T>>(() => ({ key, timer: null, latest: null, pending: null, saving: false }), [key]);
  const [restoration, setRestoration] = useState<{ key: PreferenceKey; error: string | null } | null>(null);
  const [saveErrors, setSaveErrors] = useState<Partial<Record<PreferenceKey, string | null>>>({});
  const ready = restoration?.key === key;

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPreference(key, { signal }),
    // The cache owns edits for this session; a background GET must not replace them.
    staleTime: Infinity,
  });
  const preferences = normalizePreferences(fields, query.data);

  const flush = useCallback(async () => {
    if (queue.saving) return;
    queue.saving = true;

    while (queue.pending !== null) {
      const value = queue.pending;
      queue.pending = null;

      try {
        await setPreference(queue.key, value);
        if (queue.latest === value) setSaveErrors(current => ({ ...current, [key]: null }));
      } catch (cause) {
        if (queue.latest === value) {
          const message = cause instanceof Error ? cause.message : 'Could not save preferences';
          setSaveErrors(current => ({ ...current, [key]: message }));
        }
      }
    }

    queue.saving = false;
  }, [key, queue]);

  const save = useCallback((value: T) => {
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, value);
    setSaveErrors(current => ({ ...current, [key]: null }));
    queue.latest = value;

    if (queue.timer !== null) window.clearTimeout(queue.timer);
    queue.timer = window.setTimeout(() => {
      queue.timer = null;
      queue.pending = queue.latest;
      void flush();
    }, 250);
  }, [flush, key, queryClient, queryKey, queue]);

  const updatePreferences = useCallback((patch: Partial<T>) => {
    const current = normalizePreferences(fields, queryClient.getQueryData(queryKey));
    save(normalizePreferences(fields, { ...current, ...patch }));
  }, [fields, queryClient, queryKey, save]);

  useEffect(() => {
    if (waiting || query.isLoading) return;

    if (!ready) {
      const error = query.error instanceof Error ? query.error.message : query.error ? 'Could not load saved preferences' : null;
      setRestoration({ key, error });
    }

    if (preferences === query.data) return;
    if (query.data !== null && query.data !== undefined) {
      save(preferences);
    } else {
      // Missing or unreadable preferences establish defaults locally; loading alone does not create a record.
      void queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData(queryKey, preferences);
    }
  }, [key, preferences, query.data, query.error, query.isLoading, queryClient, queryKey, ready, save, waiting]);

  useEffect(() => () => {
    if (queue.timer === null) return;
    window.clearTimeout(queue.timer);
    queue.timer = null;
    queue.pending = queue.latest;
    void flush();
  }, [flush, queue]);

  const loadError = ready ? restoration.error : null;
  const saveError = saveErrors[key] ?? null;
  return { preferences, updatePreferences, ready, error: saveError ?? loadError, loadError, saveError };
}
