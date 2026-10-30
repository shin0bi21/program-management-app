import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../../http/errors';
import {
  DataBuffer,
  type PeriodBufferAdapter,
  type PeriodRange,
} from './DataBuffer';
import type { CalendarPeriod, RowItemData, RowPeriodData } from '../../types';

type BufferLoadKey = 'initial' | 'left' | 'right' | 'reset';

interface UseDataBufferOptions<TItem> {
  // Seed data is read once for this mounted buffer.
  initialData?: RowPeriodData<TItem>;
  load: (range: PeriodRange, signal: AbortSignal) => Promise<RowPeriodData<TItem>>;
  errorMessage?: string;

  // Item identity and ranges
  getItemId: (item: TItem) => string;
  getItemRange?: (item: TItem) => { start: string; end: string };

  // Buffer configuration is read once; remount to change it.
  adapter?: PeriodBufferAdapter;
  maxRetainedPeriods?: number;
}

/**
 * Connects a range-backed calendar buffer to React state and mutation callbacks.
 * Requires `getItemId` to return a stable ID; call `initialize` with the rendered periods.
 * Example: `const { items, initialize } = useDataBuffer({ load, getItemId });`.
 */
export function useDataBuffer<TItem>({
  initialData = {},
  load,
  errorMessage = 'Unable to load calendar data',

  getItemId,
  getItemRange,

  adapter,
  maxRetainedPeriods = 250,
}: UseDataBufferOptions<TItem>) {
  const [data, setData] = useState<RowPeriodData<TItem>>(initialData);
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef<DataBuffer<TItem>>();
  const activeRef = useRef(true);
  const initialOptionsRef = useRef({ initialData, maxRetainedPeriods, adapter });
  const initialPeriodsRef = useRef<readonly CalendarPeriod[]>([]);
  const errorMessageRef = useRef(errorMessage);
  const windowRevisionRef = useRef(0);
  const loadRevisionsRef = useRef(new Map<BufferLoadKey, number>());
  const failuresRef = useRef(new Map<BufferLoadKey, {
    loadPeriods: () => Promise<void>;
    message: string;
  }>());

  const loadRef = useRef(load);
  const getItemIdRef = useRef(getItemId);
  const getItemRangeRef = useRef(getItemRange);

  useLayoutEffect(function updateCallbacks() {
    errorMessageRef.current = errorMessage;
    loadRef.current = load;
    getItemIdRef.current = getItemId;
    getItemRangeRef.current = getItemRange;
  }, [load, getItemId, getItemRange, errorMessage]);

  const getBuffer = useCallback(() => {
    // Create the buffer on first use.
    if (!bufferRef.current) {
      bufferRef.current = new DataBuffer({
        ...initialOptionsRef.current,
        load: (range, signal) => loadRef.current(range, signal),
        onData: setData,
        getItemId: item => getItemIdRef.current(item),
        getItemRange: getItemRangeRef.current ? item => getItemRangeRef.current!(item) : undefined,
      });
    }

    return bufferRef.current;
  }, []);

  /** Runs a buffer load, ignores stale results, and preserves errors from other loads. */
  const loadBuffer = useCallback(async function loadBuffer(
    key: BufferLoadKey,
    loadPeriods: () => Promise<void>,
  ) {
    if (!activeRef.current) return;

    const windowRevision = windowRevisionRef.current;
    const revision = (loadRevisionsRef.current.get(key) ?? 0) + 1;
    const previousFailure = failuresRef.current.get(key);

    loadRevisionsRef.current.set(key, revision);
    if (previousFailure) failuresRef.current.set(key, { ...previousFailure, loadPeriods });

    let failureMessage: string | null = null;
    try {
      await loadPeriods();
    } catch (cause: unknown) {
      failureMessage = getErrorMessage(cause, errorMessageRef.current);
    }

    // Reset, unmount, or a newer load can make this completion obsolete.
    const windowChanged = windowRevision !== windowRevisionRef.current;
    const loadWasReplaced = loadRevisionsRef.current.get(key) !== revision;
    if (windowChanged || loadWasReplaced) return;

    if (failureMessage !== null) {
      failuresRef.current.set(key, { loadPeriods, message: failureMessage });
    } else {
      failuresRef.current.delete(key);

      // A successful edge load also confirms its prerequisite window initialization recovered.
      const loadedEdge = key === 'left' || key === 'right';
      if (loadedEdge) {
        failuresRef.current.delete('initial');
        failuresRef.current.delete('reset');
      }
    }

    let firstFailureMessage: string | null = null;
    for (const failure of failuresRef.current.values()) {
      firstFailureMessage = failure.message;
      break;
    }
    setError(firstFailureMessage);
  }, []);

  // Calendar events request the initial range, additional periods, or a replacement window.
  /** Loads the initial window while sharing any in-flight initialization. */
  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    initialPeriodsRef.current = periods;
    void loadBuffer('initial', () => getBuffer().initialize(periods));
  }, [getBuffer, loadBuffer]);

  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    if (!periods.length) return;

    void loadBuffer(direction, () => getBuffer().periodsBuilt(periods, direction));
  }, [getBuffer, loadBuffer]);

  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    if (!periods.length) return;

    initialPeriodsRef.current = periods;
    windowRevisionRef.current += 1;
    failuresRef.current.clear();
    loadRevisionsRef.current.clear();

    setError(null);
    void loadBuffer('reset', () => getBuffer().reset(periods));
  }, [getBuffer, loadBuffer]);

  /** Retries every failed edge so one successful load cannot hide another failed range. */
  const retry = useCallback(() => {
    for (const [key, failure] of failuresRef.current) {
      void loadBuffer(key, failure.loadPeriods);
    }
  }, [loadBuffer]);

  // Reconcile saved changes with cached data so pending reads cannot undo them.
  const upsertItem = useCallback((rowId: string, periodKey: string, item: TItem) => {
    if (!activeRef.current) return;

    getBuffer().upsertItem(rowId, periodKey, item);
  }, [getBuffer]);

  /** Retains a delete override until later loads acknowledge it. */
  const removeItem = useCallback((itemId: string) => {
    if (!activeRef.current) return;

    getBuffer().removeItem(itemId);
  }, [getBuffer]);

  // Own cancellation and cleanup independently of the calendar event handlers.
  useLayoutEffect(function manageBufferLifecycle() {
    const failures = failuresRef.current;
    const loadRevisions = loadRevisionsRef.current;

    activeRef.current = true;

    // StrictMode replays effects without repeating the child's initial-period notification.
    if (initialPeriodsRef.current.length) initialize(initialPeriodsRef.current);

    return () => {
      activeRef.current = false;
      windowRevisionRef.current += 1;

      failures.clear();
      loadRevisions.clear();

      bufferRef.current?.dispose();
      bufferRef.current = undefined;
    };
  }, [initialize]);

  const items = useMemo(() => getItems(data, getItemId), [data, getItemId]);

  return {
    data,
    items,
    error,
    initialize,
    onPeriodsBuilt,
    reset,
    retry,
    upsertItem,
    removeItem,
  };
}

/** Flatten each row's buffered periods into ID-deduplicated items. */
function getItems<TItem>(
  data: RowPeriodData<TItem>,
  getItemId: (item: TItem) => string,
): RowItemData<TItem> {
  const itemsByRow: RowItemData<TItem> = {};

  // Collect each row independently so items stay with their owning row.
  for (const [rowId, periods] of Object.entries(data)) {
    const itemsById = new Map<string, TItem>();

    // Merge the row's periods; later occurrences replace earlier items with the same ID.
    for (const periodItems of Object.values(periods)) {
      for (const item of periodItems) {
        const itemId = getItemId(item);
        itemsById.set(itemId, item);
      }
    }

    // Return a flat array for this row, including an empty array when it has no items.
    itemsByRow[rowId] = [...itemsById.values()];
  }

  return itemsByRow;
}
