import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { getUser } from '../../../auth/storage';
import type { PreferenceKey } from './preferences.api';
import { normalizePreferences, preferenceColumnWidths, preferenceHiddenColumns } from './preferences';

interface TableLayout {
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

/**
 * Restores browser-local column widths and visibility for one user's table.
 * Unsupported column keys are ignored while valid settings remain usable.
 * @param options - Stable preference key and current supported column keys.
 * @example useTableLayout({ key: 'session-filters', tableKeys: ['cycle', 'title'] })
 */
export default function useTableLayout({ key, tableKeys }: {
  key: PreferenceKey;
  tableKeys: readonly string[];
}) {
  const client = useQueryClient();
  const userId = readUserId();
  const storageKey = userId ? `table-layout:v1:${userId}:${key}` : null;
  const queryKey = useMemo(() => ['table-layout', userId, key] as const, [userId, key]);
  const fields = {
    columnWidths: preferenceColumnWidths(tableKeys),
    hiddenColumns: preferenceHiddenColumns(tableKeys),
  };
  const { data } = useQuery<unknown>({
    queryKey,
    queryFn: skipToken,
    initialData: () => {
      try {
        return readLayout(storageKey);
      } catch {
        return null;
      }
    },
  });
  const layout = normalizePreferences(fields, data);

  useEffect(() => {
    const restore = () => {
      try {
        client.setQueryData(queryKey, readLayout(storageKey));
      } catch {
        // Blocked storage must leave this session's in-memory layout usable.
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) restore();
    };

    restore();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [client, queryKey, storageKey]);

  const updateLayout = (patch: Partial<TableLayout>) => {
    const current = normalizePreferences(fields, client.getQueryData(queryKey));
    const next = normalizePreferences(fields, { ...current, ...patch });
    client.setQueryData(queryKey, next);

    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Layout edits still work when persistence is unavailable or full.
    }
  };

  return {
    ...layout,
    setColumnWidths: (columnWidths: Record<string, number>) => updateLayout({ columnWidths }),
    setHiddenColumns: (hiddenColumns: string[]) => updateLayout({ hiddenColumns }),
  };
}

/**
 * Reads the signed-in user's storage scope, returning null for missing or invalid identity.
 * @example readUserId() // 'user-1' when that user is signed in.
 */
function readUserId() {
  try {
    const id = getUser()?.id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

/**
 * Reads untrusted layout JSON, returning null for missing or malformed data.
 * Storage access failures propagate to the caller's in-memory fallback.
 * @param storageKey - User/table storage key, or null when signed out.
 * @example readLayout(null) // null
 */
function readLayout(storageKey: string | null): unknown {
  if (!storageKey) return null;
  const stored = localStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}
