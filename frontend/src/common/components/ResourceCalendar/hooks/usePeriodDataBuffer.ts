import { useCallback, useRef, useState } from 'react';
import { getErrorMessage } from '../../../../http/clientErrors';
import { dayBufferAdapter } from '../dayBufferAdapter';
import { PeriodDataBuffer, type PeriodRange } from '../PeriodDataBuffer';
import type { CalendarPeriod, ResourcePeriodData, ResourceRangeData } from '../types';

interface UsePeriodDataBufferOptions<TItem> {
  initialData?: ResourcePeriodData<TItem>;
  load: (range: PeriodRange) => Promise<ResourcePeriodData<TItem>>;
  getItemId: (item: TItem) => string;
  maxRetainedPeriods?: number;
  errorMessage?: string;
}

function flattenRangeData<TItem>(
  data: ResourcePeriodData<TItem>,
  getItemId: (item: TItem) => string,
): ResourceRangeData<TItem> {
  return Object.fromEntries(Object.entries(data).map(([resourceId, periods]) => {
    const items = new Map<string, TItem>();
    Object.values(periods).forEach(periodItems => {
      periodItems.forEach(item => items.set(getItemId(item), item));
    });
    return [resourceId, [...items.values()]];
  }));
}

export function usePeriodDataBuffer<TItem>({
  initialData = {},
  load,
  getItemId,
  maxRetainedPeriods = 250,
  errorMessage = 'Unable to load calendar data',
}: UsePeriodDataBufferOptions<TItem>) {
  const [data, setData] = useState<ResourcePeriodData<TItem>>(initialData);
  const [error, setError] = useState<string | null>(null);
  const bufferRef = useRef<PeriodDataBuffer<TItem>>();
  const retryRef = useRef<(() => void) | null>(null);
  const operationRevisionRef = useRef(0);
  const loadRef = useRef(load);
  const getItemIdRef = useRef(getItemId);
  loadRef.current = load;
  getItemIdRef.current = getItemId;

  if (!bufferRef.current) {
    bufferRef.current = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
      load: range => loadRef.current(range),
      onData: setData,
      initialData,
      maxRetainedPeriods,
      getItemId: item => getItemIdRef.current(item),
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

  const upsertItem = useCallback((resourceId: string, periodKey: string, item: TItem) => {
    getBuffer().upsertItem(resourceId, periodKey, item);
  }, [getBuffer]);

  const removeItem = useCallback((itemId: string) => {
    getBuffer().removeItem(itemId);
  }, [getBuffer]);

  const retry = useCallback(() => retryRef.current?.(), []);

  return {
    data,
    rangeData: flattenRangeData(data, getItemId),
    error,
    upsertItem,
    removeItem,
    initialize,
    reset,
    onPeriodsBuilt,
    retry,
  };
}
