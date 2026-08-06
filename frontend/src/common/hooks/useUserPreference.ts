import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getPreference,
  setPreference,
  type PreferenceKey,
  type PreferenceValues,
} from '../api/preferences.api';

export default function useUserPreference<K extends PreferenceKey>(key: K) {
  const [preference, setLocalPreference] = useState<PreferenceValues[K] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<PreferenceValues[K] | null>(null);
  const queuedRef = useRef<PreferenceValues[K] | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    activeRef.current = true;
    getPreference(key)
      .then(value => { if (active) setLocalPreference(value); })
      .catch(cause => {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load saved filters');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => {
      active = false;
      activeRef.current = false;
    };
  }, [key]);

  const flushQueue = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    while (queuedRef.current) {
      const value = queuedRef.current;
      queuedRef.current = null;
      try {
        const persisted = await setPreference(key, value);
        if (activeRef.current && queuedRef.current === null) {
          setLocalPreference(persisted);
          setError(null);
        }
      } catch (cause) {
        if (activeRef.current && queuedRef.current === null) {
          setError(cause instanceof Error ? cause.message : 'Could not save filters');
        }
      }
    }

    savingRef.current = false;
  }, [key]);

  const save = useCallback((value: PreferenceValues[K]) => {
    setLocalPreference(value);
    setError(null);
    pendingRef.current = value;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      queuedRef.current = pendingRef.current;
      pendingRef.current = null;
      void flushQueue();
    }, 250);
  }, [flushQueue]);

  useEffect(() => () => {
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    if (pendingRef.current) {
      queuedRef.current = pendingRef.current;
      pendingRef.current = null;
    }
    void flushQueue();
  }, [flushQueue]);

  return { preference, loading, error, save };
}
