import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { getUser } from '../../../auth/storage';
import type { PreferenceKey } from './preferences.api';
import { normalizePreferences, preferenceColumnWidths, preferenceHiddenColumns } from './preferences';

interface TableLayout {
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

function renameLayoutColumns(value: unknown, aliases: Readonly<Record<string, string>> | undefined): unknown {
  if (!aliases || !value || typeof value !== 'object' || Array.isArray(value)) return value;

  let layout = value as Record<string, unknown>;
  for (const [previous, current] of Object.entries(aliases)) {
    const widths = layout.columnWidths;
    if (widths && typeof widths === 'object' && !Array.isArray(widths) && Object.prototype.hasOwnProperty.call(widths, previous)) {
      const renamed = { ...widths } as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(renamed, current)) renamed[current] = renamed[previous];
      delete renamed[previous];
      layout = { ...layout, columnWidths: renamed };
    }

    if (Array.isArray(layout.hiddenColumns) && layout.hiddenColumns.includes(previous)) {
      const hiddenColumns = [...new Set(layout.hiddenColumns.map(key => key === previous ? current : key))];
      layout = { ...layout, hiddenColumns };
    }
  }
  return layout;
}

function readUserId() {
  try {
    const id = getUser()?.id;
    return typeof id === 'string' && id ? id : null;
  } catch {
    return null;
  }
}

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

export default function useTableLayout({ key, tableKeys, columnKeyAliases }: {
  key: PreferenceKey;
  tableKeys: readonly string[];
  columnKeyAliases?: Readonly<Record<string, string>>;
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
        return renameLayoutColumns(readLayout(storageKey), columnKeyAliases);
      } catch {
        return null;
      }
    },
  });
  const layout = normalizePreferences(fields, data);

  useEffect(() => {
    const restore = () => {
      try {
        const stored = readLayout(storageKey);
        const restored = renameLayoutColumns(stored, columnKeyAliases);
        client.setQueryData(queryKey, restored);

        if (storageKey && restored !== stored) {
          try {
            localStorage.setItem(storageKey, JSON.stringify(restored));
          } catch {
            // A failed migration write must not discard the restored layout in memory.
          }
        }
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
  }, [client, columnKeyAliases, queryKey, storageKey]);

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
