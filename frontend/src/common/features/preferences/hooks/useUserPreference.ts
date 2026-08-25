import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getPreference,
  setPreference,
  type PreferenceKey,
} from '../preferences.api';

interface TablePreferenceFields {
  columnWidths?: Record<string, number>;
  hiddenColumns?: string[];
}

type PreferenceUpdate<T> = T | ((current: T | null) => T);

function sanitizeColumns<T extends object>(
  value: T | null,
  columnKeys?: readonly string[],
): T | null {
  if (!value || !columnKeys) return value;

  const allowedKeys = new Set(columnKeys);
  const tablePreference = value as T & TablePreferenceFields;

  return {
    ...value,
    ...(tablePreference.columnWidths ? {
      columnWidths: Object.fromEntries(
        Object.entries(tablePreference.columnWidths)
          .filter(([columnKey]) => allowedKeys.has(columnKey)),
      ),
    } : {}),
    ...(tablePreference.hiddenColumns ? {
      hiddenColumns: tablePreference.hiddenColumns.filter(columnKey => allowedKeys.has(columnKey)),
    } : {}),
  };
}

export default function useUserPreference<T extends object>(
  key: PreferenceKey,
  columnKeys?: readonly string[],
) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['user-preference', key] as const, [key]);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingRef = useRef<T | null>(null);
  const queuedRef = useRef<T | null>(null);
  const latestValueRef = useRef<T | null>(null);
  const savingRef = useRef(false);
  const selectPreference = useCallback(
    (value: T | null) => sanitizeColumns(value, columnKeys),
    [columnKeys],
  );

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPreference<T>(key, { signal }),
    select: selectPreference,
  });
  const { mutateAsync } = useMutation({
    mutationFn: (value: T) => setPreference(key, value),
  });

  const initializePreference = useCallback((value: T) => {
    const normalized = sanitizeColumns(value, columnKeys)!;
    void queryClient.cancelQueries({ queryKey, exact: true });
    latestValueRef.current = normalized;
    queryClient.setQueryData(queryKey, normalized);
  }, [columnKeys, queryClient, queryKey]);

  const flushQueue = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    while (queuedRef.current) {
      const value = queuedRef.current;
      queuedRef.current = null;
      try {
        await mutateAsync(value);
        if (latestValueRef.current === value) {
          setError(null);
        }
      } catch (cause) {
        if (latestValueRef.current === value) {
          setError(cause instanceof Error ? cause.message : 'Could not save preferences');
        }
      }
    }

    savingRef.current = false;
  }, [mutateAsync]);

  const save = useCallback((update: PreferenceUpdate<T>) => {
    const current = latestValueRef.current
      ?? sanitizeColumns(queryClient.getQueryData<T | null>(queryKey) ?? null, columnKeys)
      ?? null;
    const updated = typeof update === 'function' ? update(current) : update;
    const value = sanitizeColumns(updated, columnKeys)!;
    void queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData(queryKey, value);
    setError(null);
    latestValueRef.current = value;
    pendingRef.current = value;
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null;
      queuedRef.current = pendingRef.current;
      pendingRef.current = null;
      void flushQueue();
    }, 250);
  }, [columnKeys, flushQueue, queryClient, queryKey]);

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
    : query.error ? 'Could not load saved preferences' : null;

  return {
    preference: query.data ?? null,
    loading: query.isLoading,
    error: error ?? queryError,
    initializePreference,
    save,
  };
}
