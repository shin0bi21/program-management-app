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
 * Supplies calendar items for the rendered range, initially loading 42 extra periods
 * on each side. Loads 21 more when the remaining margin falls to 21 periods.
 * Call initialize with ordered, contiguous rendered periods. Loading callbacks return
 * immediately; failures become error/retry state, and unmount aborts pending loads.
 * @param options.load - Latest committed loader for authoritative inclusive ranges,
 * grouped by row and period; omitted items are removed from the requested range.
 * Forward its signal to the request and treat supplied snapshots as immutable.
 * @param options.errorMessage - Fallback when a failure supplies no message.
 * @param options.getItemId - Stable, globally unique identity across loads and edits, e.g. task.id.
 * @param options.getItemRange - Ordered first and last period keys occupied by an item,
 * both included. Keep its presence and range semantics unchanged while mounted.
 * @param options.initialData - Seed snapshot read once for this mount; loading still runs.
 * @param options.adapter - How periods are counted and shifted; defaults to calendar days.
 * @param options.maxRetainedPeriods - Limit on periods kept in memory (250 by default).
 * Must fit the initial rendered range plus its 84 extra periods.
 * @returns Immutable buffered data by row/period, ID-deduplicated items by row,
 * the first outstanding failure message (or null), and loading/retry/update/delete callbacks.
 * @example A 10-day rendered range initially requests 94 days of data.
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

  /**
   * Makes future buffer calls use callbacks and fallback text from the committed render.
   * @example After a filter change commits, the next reset uses the new loader.
   */
  useLayoutEffect(function updateCallbacks() {
    errorMessageRef.current = errorMessage;
    loadRef.current = load;
    getItemIdRef.current = getItemId;
    getItemRangeRef.current = getItemRange;
  }, [load, getItemId, getItemRange, errorMessage]);

  /**
   * Creates the calendar's data cache on first use, then reuses it until lifecycle cleanup.
   * @returns The live buffer using mount-time configuration and committed callbacks.
   * @example The first initialize call creates a buffer; later edge loads reuse it.
   */
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

  /**
   * Runs a load and records its failure unless its error state was superseded or the calendar closed.
   * @param key - Independent failure/retry slot for initialization, an edge, or reset.
   * @param loadPeriods - Operation to run now and retain for retry if it fails.
   * @returns Completion after handling any operation rejection; only current loads update error state.
   * @example A successful right-edge load does not hide an outstanding left-edge failure.
   */
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
  /**
   * Starts loading around the calendar's first rendered dates, reusing an already pending initial load.
   * @param periods - Ordered contiguous rendered periods; empty input performs no load.
   * @example Replaying mount effects restarts an interrupted initialization of these periods.
   */
  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    initialPeriodsRef.current = periods;
    void loadBuffer('initial', () => getBuffer().initialize(periods));
  }, [getBuffer, loadBuffer]);

  /**
   * Loads more calendar items as scrolling exposes new dates on either side.
   * @param periods - Ordered contiguous new periods at the indicated edge; empty input is ignored.
   * @param direction - Edge whose rendered boundary changed.
   * @example Scrolling right near the last loaded date fetches more future items.
   */
  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    if (!periods.length) return;

    void loadBuffer(direction, () => getBuffer().periodsBuilt(periods, direction));
  }, [getBuffer, loadBuffer]);

  /**
   * Starts loading around a new displayed range and discards earlier range failure state.
   * Existing data remains visible until replacement loading publishes a snapshot.
   * @param periods - Ordered contiguous replacement window; empty input is ignored.
   * @example Jumping to a distant date discards previous edge failures before loading its window.
   */
  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    if (!periods.length) return;

    initialPeriodsRef.current = periods;
    windowRevisionRef.current += 1;
    failuresRef.current.clear();
    loadRevisionsRef.current.clear();

    setError(null);
    void loadBuffer('reset', () => getBuffer().reset(periods));
  }, [getBuffer, loadBuffer]);

  /**
   * Retries every failed range load, including failures on both sides of the calendar.
   * Starts each retained operation without awaiting it; error clears as failures recover.
   * @example Failed left and right loads are both retried by one page Retry action.
   */
  const retry = useCallback(() => {
    for (const [key, failure] of failuresRef.current) {
      void loadBuffer(key, failure.loadPeriods);
    }
  }, [loadBuffer]);

  // Reconcile saved changes with cached data so pending reads cannot undo them.
  /**
   * Adds or replaces a saved item immediately and records an override for pending range reads.
   * @param rowId - Destination resource, e.g. a staff ID.
   * @param periodKey - Destination period bucket in the adapter's key format.
   * @param item - Complete saved backend record with the same stable ID as any previous placement.
   * @example Moving task-1 updates its destination row while a previous range read is pending.
   */
  const upsertItem = useCallback((rowId: string, periodKey: string, item: TItem) => {
    if (!activeRef.current) return;

    getBuffer().upsertItem(rowId, periodKey, item);
  }, [getBuffer]);

  /**
   * Removes a deleted item immediately and records a delete override for range reconciliation.
   * @param itemId - Stable ID of the confirmed deleted record, including one absent from the cache.
   * @example A late response containing deleted task-1 cannot restore it to the calendar.
   */
  const removeItem = useCallback((itemId: string) => {
    if (!activeRef.current) return;

    getBuffer().removeItem(itemId);
  }, [getBuffer]);

  // Own cancellation and cleanup independently of the calendar event handlers.
  /**
   * Keeps one active buffer per effect lifetime and restarts remembered initialization on replay.
   * @returns Cleanup that invalidates error completions, aborts loads, and discards the buffer.
   * @example StrictMode cleanup aborts the first load; effect replay starts a fresh buffer.
   */
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

/**
 * Flattens each row's buffered periods by stable ID; later occurrences win within a row.
 * @param data - Immutable row/period buckets; empty rows are retained.
 * @param getItemId - Stable record identity used to collapse repeated period placements.
 * @returns One array per row, ordered by first ID encounter, with each ID's last encountered record.
 * @example A row with [{ id: 'a', value: 1 }] then [{ id: 'a', value: 2 }] yields [{ id: 'a', value: 2 }].
 */
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
