import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../../http/errors';
import {
  DataBuffer,
  type PeriodBufferAdapter,
  type PeriodRange,
} from './DataBuffer';
import type { CalendarPeriod, RowItemData, RowPeriodData } from '../../types';

type BufferOperationKey = 'initial' | 'left' | 'right' | 'reset';

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
  const windowRevisionRef = useRef(0);
  const operationRevisionsRef = useRef(new Map<BufferOperationKey, number>());
  const failuresRef = useRef(new Map<BufferOperationKey, {
    operation: () => Promise<void>;
    message: string;
  }>());

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

  /** Tracks the latest operation per edge while retaining failures from other edges. */
  const runBufferOperation = useCallback(function runBufferOperation(
    key: BufferOperationKey,
    operation: () => Promise<void>,
  ) {
    const windowRevision = windowRevisionRef.current;
    const revision = (operationRevisionsRef.current.get(key) ?? 0) + 1;
    const previousFailure = failuresRef.current.get(key);

    operationRevisionsRef.current.set(key, revision);
    if (previousFailure) failuresRef.current.set(key, { ...previousFailure, operation });

    operation()
      .then(() => {
        if (windowRevision !== windowRevisionRef.current
          || operationRevisionsRef.current.get(key) !== revision) return;

        failuresRef.current.delete(key);
        // A successful edge load also confirms its prerequisite window initialization recovered.
        if (key === 'left' || key === 'right') {
          failuresRef.current.delete('initial');
          failuresRef.current.delete('reset');
        }

        setError(failuresRef.current.values().next().value?.message ?? null);
      })
      .catch((cause: unknown) => {
        if (windowRevision !== windowRevisionRef.current
          || operationRevisionsRef.current.get(key) !== revision) return;

        failuresRef.current.set(key, { operation, message: getErrorMessage(cause, errorMessage) });

        setError(failuresRef.current.values().next().value?.message ?? null);
      });
  }, [errorMessage]);

  /** Loads the initial window while sharing any in-flight initialization. */
  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    runBufferOperation('initial', () => getBuffer().initialize(periods));
  }, [getBuffer, runBufferOperation]);

  /** Extends the buffered window when virtualization exposes a new edge. */
  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    if (!periods.length) return;

    runBufferOperation(direction, () => getBuffer().periodsBuilt(periods, direction));
  }, [getBuffer, runBufferOperation]);

  /** Reloads around a replacement visible window. */
  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    if (!periods.length) return;

    windowRevisionRef.current += 1;
    failuresRef.current.clear();
    operationRevisionsRef.current.clear();
    setError(null);
    runBufferOperation('reset', () => getBuffer().reset(periods));
  }, [getBuffer, runBufferOperation]);

  /** Reconciles a saved or moved record into the current buffer. */
  const upsertItem = useCallback((rowId: string, periodKey: string, item: TItem) => {
    getBuffer().upsertItem(rowId, periodKey, item);
  }, [getBuffer]);

  /** Retains a delete override until later loads acknowledge it. */
  const removeItem = useCallback((itemId: string) => {
    getBuffer().removeItem(itemId);
  }, [getBuffer]);

  /** Retries every failed edge so one successful load cannot hide another failed range. */
  const retry = useCallback(() => {
    failuresRef.current.forEach((failure, key) => {
      runBufferOperation(key, failure.operation);
    });
  }, [runBufferOperation]);
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
