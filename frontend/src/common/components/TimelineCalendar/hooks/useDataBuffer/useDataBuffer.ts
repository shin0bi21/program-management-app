import { useCallback, useMemo, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../../http/errors';
import {
  DataBuffer,
  type PeriodBufferAdapter,
  type PeriodRange,
} from './DataBuffer';
import type { CalendarPeriod, RowItemData, RowPeriodData } from '../../types';

interface UseDataBufferOptions<TItem> {
  initialData?: RowPeriodData<TItem>;
  load: (range: PeriodRange) => Promise<RowPeriodData<TItem>>;
  getItemId: (item: TItem) => string;
  getItemRange?: (item: TItem) => { start: string; end: string };
  adapter?: PeriodBufferAdapter;
  maxRetainedPeriods?: number;
  errorMessage?: string;
}

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

export function useDataBuffer<TItem>({
  initialData = {},
  load,
  getItemId,
  getItemRange,
  adapter,
  maxRetainedPeriods = 250,
  errorMessage = 'Unable to load calendar data',
}: UseDataBufferOptions<TItem>) {
  const [data, setData] = useState<RowPeriodData<TItem>>(initialData);
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef<DataBuffer<TItem>>();
  const retryRef = useRef<(() => void) | null>(null);
  const operationRevisionRef = useRef(0);

  const loadRef = useRef(load);
  const getItemIdRef = useRef(getItemId);
  const getItemRangeRef = useRef(getItemRange);

  loadRef.current = load;
  getItemIdRef.current = getItemId;
  getItemRangeRef.current = getItemRange;

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

  const getBuffer = useCallback(() => {
    if (!bufferRef.current) throw new Error('Calendar data buffer was not initialized.');

    return bufferRef.current;
  }, []);

  const run = useCallback(function runOperation(operation: () => Promise<void>) {
    const revision = operationRevisionRef.current + 1;
    operationRevisionRef.current = revision;
    retryRef.current = () => runOperation(operation);

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

  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    run(() => getBuffer().initialize(periods));
  }, [getBuffer, run]);

  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    run(() => getBuffer().periodsBuilt(periods, direction));
  }, [getBuffer, run]);

  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    run(() => getBuffer().reset(periods));
  }, [getBuffer, run]);

  const upsertItem = useCallback((rowId: string, periodKey: string, item: TItem) => {
    getBuffer().upsertItem(rowId, periodKey, item);
  }, [getBuffer]);

  const removeItem = useCallback((itemId: string) => {
    getBuffer().removeItem(itemId);
  }, [getBuffer]);

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
