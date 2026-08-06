import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPreference,
  setPreference,
  type PreferenceKey,
  type PreferenceValues,
} from '../api/preferences.api';

export default function useUserPreference<K extends PreferenceKey>(key: K) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['user-preference', key] as const, [key]);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<PreferenceValues[K] | null>(null);
  const queuedRef = useRef<PreferenceValues[K] | null>(null);
  const savingRef = useRef(false);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPreference(key, { signal }),
  });
  const { mutateAsync } = useMutation({
    mutationFn: (value: PreferenceValues[K]) => setPreference(key, value),
  });

  const flushQueue = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    while (queuedRef.current) {
      const value = queuedRef.current;
      queuedRef.current = null;
      try {
        const persisted = await mutateAsync(value);
        if (queuedRef.current === null) {
          queryClient.setQueryData(queryKey, persisted);
          setError(null);
        }
      } catch (cause) {
        if (queuedRef.current === null) {
          setError(cause instanceof Error ? cause.message : 'Could not save filters');
        }
      }
    }

    savingRef.current = false;
  }, [mutateAsync, queryClient, queryKey]);

  const save = useCallback((value: PreferenceValues[K]) => {
    queryClient.setQueryData(queryKey, value);
    setError(null);
    pendingRef.current = value;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      queuedRef.current = pendingRef.current;
      pendingRef.current = null;
      void flushQueue();
    }, 250);
  }, [flushQueue, queryClient, queryKey]);

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    if (pendingRef.current) {
      queuedRef.current = pendingRef.current;
      pendingRef.current = null;
    }
    void flushQueue();
  }, [flushQueue]);

  const queryError = query.error instanceof Error
    ? query.error.message
    : query.error ? 'Could not load saved filters' : null;

  return {
    preference: query.data ?? null,
    loading: query.isLoading,
    error: error ?? queryError,
    save,
  };
}
