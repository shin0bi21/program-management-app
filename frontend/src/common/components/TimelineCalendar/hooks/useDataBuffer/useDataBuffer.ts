import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../../http/errors';
import {
  DataBuffer,
  type PeriodBufferAdapter,
  type PeriodRange,
} from './DataBuffer';
import type { CalendarPeriod, RowItemData, RowPeriodData } from '../../types';

interface UseDataBufferOptions<TItem> {
  // Data loading
  initialData?: RowPeriodData<TItem>;
  load: (range: PeriodRange) => Promise<RowPeriodData<TItem>>;
  errorMessage?: string;

  // Item identity and ranges
  getItemId: (item: TItem) => string;
  getItemRange?: (item: TItem) => { start: string; end: string };

  // Period buffering
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
  const retryRef = useRef<(() => void) | null>(null);
  const operationRevisionRef = useRef(0);

  const loadRef = useRef(load);
  const getItemIdRef = useRef(getItemId);
  const getItemRangeRef = useRef(getItemRange);

  useLayoutEffect(function publishBufferCallbacks() {
    loadRef.current = load;
    getItemIdRef.current = getItemId;
    getItemRangeRef.current = getItemRange;
  }, [load, getItemId, getItemRange]);

  // Keep the loaded window alive while load and item-identity callbacks stay current through refs.
  if (!bufferRef.current) {
    bufferRef.current = new DataBuffer({
      load: range => loadRef.current(range),
      onData: setData,
      initialData,
      maxRetainedPeriods,
      getItemId: item => getItemIdRef.current(item),
      getItemRange: getItemRange ? item => getItemRangeRef.current!(item) : undefined,
      adapter,
    });
  }

  /** Returns the initialized instance shared by loading and mutation operations. */
  const getBuffer = useCallback(() => {
    if (!bufferRef.current) throw new Error('Calendar data buffer was not initialized.');

    return bufferRef.current;
  }, []);

  /** Runs one buffer load and retains only the latest operation's retry/error result. */
  const runBufferOperation = useCallback(function runBufferOperation(operation: () => Promise<void>) {
    const revision = operationRevisionRef.current + 1;
    operationRevisionRef.current = revision;
    retryRef.current = () => runBufferOperation(operation);

    operation()
      .then(() => {
        if (operationRevisionRef.current !== revision) return;

        retryRef.current = null;
        setError(null);
      })
      .catch((cause: unknown) => {
        if (operationRevisionRef.current === revision) setError(getErrorMessage(cause, errorMessage));
      });
  }, [errorMessage]);

  /** Loads the initial window while sharing any in-flight initialization. */
  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    runBufferOperation(() => getBuffer().initialize(periods));
  }, [getBuffer, runBufferOperation]);

  /** Extends the buffered window when virtualization exposes a new edge. */
  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    runBufferOperation(() => getBuffer().periodsBuilt(periods, direction));
  }, [getBuffer, runBufferOperation]);

  /** Reloads around a replacement visible window. */
  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    runBufferOperation(() => getBuffer().reset(periods));
  }, [getBuffer, runBufferOperation]);

  /** Reconciles a saved or moved record into the current buffer. */
  const upsertItem = useCallback((rowId: string, periodKey: string, item: TItem) => {
    getBuffer().upsertItem(rowId, periodKey, item);
  }, [getBuffer]);

  /** Retains a delete override until later loads acknowledge it. */
  const removeItem = useCallback((itemId: string) => {
    getBuffer().removeItem(itemId);
  }, [getBuffer]);

  /** Retries the latest failed operation using the same buffer instance. */
  const retry = useCallback(() => retryRef.current?.(), []);
  const items = useMemo(() => flattenItems(data, getItemId), [data, getItemId]);

  return {
    data,
    items,
    error,
    upsertItem,
    removeItem,
    initialize,
    reset,
    onPeriodsBuilt,
    retry,
  };
}

/** Flatten each row's buffered periods into ID-deduplicated items. */
function flattenItems<TItem>(
  data: RowPeriodData<TItem>,
  getItemId: (item: TItem) => string,
): RowItemData<TItem> {
  return Object.fromEntries(Object.entries(data).map(([rowId, periods]) => {
    const items = new Map<string, TItem>();

    Object.values(periods).forEach(periodItems => {
      periodItems.forEach(item => items.set(getItemId(item), item));
    });

    return [rowId, [...items.values()]];
  }));
}
