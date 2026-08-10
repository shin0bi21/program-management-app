import { useCallback, useRef, useState } from 'react';
import { dayBufferAdapter } from '../../../../common/components/ResourceCalendar/dayBufferAdapter';
import {
  PeriodDataBuffer,
  type PeriodRange,
} from '../../../../common/components/ResourceCalendar/PeriodDataBuffer';
import type {
  CalendarPeriod,
  ResourcePeriodData,
} from '../../../../common/components/ResourceCalendar/types';
import { getErrorMessage } from '../../../../http/clientErrors';
import type { TimesheetItem } from '../types';

interface UseTimesheetBufferOptions {
  initialData?: ResourcePeriodData<TimesheetItem>;
  load: (range: PeriodRange) => Promise<ResourcePeriodData<TimesheetItem>>;
  maxRetainedPeriods?: number;
}

export function useTimesheetBuffer({ initialData = {}, load, maxRetainedPeriods = 250 }: UseTimesheetBufferOptions) {
  const [data, setData] = useState<ResourcePeriodData<TimesheetItem>>(initialData);
  const [error, setError] = useState<string | null>(null);
  const bufferRef = useRef<PeriodDataBuffer<TimesheetItem>>();
  const retryRef = useRef<(() => void) | null>(null);
  const operationRevisionRef = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  if (!bufferRef.current) {
    bufferRef.current = new PeriodDataBuffer({
      adapter: dayBufferAdapter,
      load: range => loadRef.current(range),
      onData: setData,
      initialData,
      maxRetainedPeriods,
      getItemId: item => item.id,
    });
  }

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
        if (operationRevisionRef.current === revision) {
          setError(getErrorMessage(cause, 'Unable to load timesheet data'));
        }
      });
  }, []);

  const initialize = useCallback((periods: readonly CalendarPeriod[]) => {
    run(() => bufferRef.current?.initialize(periods) ?? Promise.resolve());
  }, [run]);

  const onPeriodsBuilt = useCallback((periods: readonly CalendarPeriod[], direction: 'left' | 'right') => {
    run(() => bufferRef.current?.periodsBuilt(periods, direction) ?? Promise.resolve());
  }, [run]);

  const reset = useCallback((periods: readonly CalendarPeriod[]) => {
    run(() => bufferRef.current?.reset(periods) ?? Promise.resolve());
  }, [run]);

  const upsertItem = useCallback((resourceId: string, periodKey: string, item: TimesheetItem) => {
    bufferRef.current?.upsertItem(resourceId, periodKey, item);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    bufferRef.current?.removeItem(itemId);
  }, []);

  const retry = useCallback(() => {
    retryRef.current?.();
  }, []);

  return { data, error, upsertItem, removeItem, initialize, reset, onPeriodsBuilt, retry };
}
