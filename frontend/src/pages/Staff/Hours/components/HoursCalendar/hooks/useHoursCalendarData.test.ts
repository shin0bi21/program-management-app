import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { RowPeriodData } from '../../../../../../common/components/TimelineCalendar/types';
import type { HoursItem } from '../../../types';
import { useHoursCalendarData } from './useHoursCalendarData';

const entry = (id: string, category: HoursItem['category']): HoursItem => ({
  id,
  programId: null,
  programName: null,
  cycleId: 'cycle-1',
  cycleName: 'Summer 2026',
  category,
  categoryLabel: category,
  taskId: null,
  taskTitle: null, sessionId: null, sessionLabel: null,
  hours: 1,
  note: id,
});

describe('useHoursCalendarData', () => {
  it('returns the source object unchanged when no filters are active', () => {
    const data: RowPeriodData<HoursItem> = {
      first: { '2026-08-09': [entry('entry-1', 'meeting')] },
    };

    const { result } = renderHook(() => useHoursCalendarData(data, [], [], []));

    expect(result.current).toBe(data);
  });

  it('preserves filtered data references for unchanged resources', () => {
    const firstResource = { '2026-08-09': [entry('entry-1', 'meeting')] };
    const secondResource = { '2026-08-09': [entry('entry-2', 'meeting')] };
    const initial: RowPeriodData<HoursItem> = { first: firstResource, second: secondResource };
    const { result, rerender } = renderHook(
      ({ data }) => useHoursCalendarData(data, ['meeting'], [], []),
      { initialProps: { data: initial } },
    );
    const previousSecond = result.current.second;

    rerender({ data: { first: { '2026-08-09': [entry('entry-1', 'other')] }, second: secondResource } });

    expect(result.current.second).toBe(previousSecond);
    expect(result.current.first['2026-08-09']).toEqual([]);
  });

  it('filters entries by their stored cycle ID', () => {
    const otherCycle = { ...entry('entry-2', 'meeting'), cycleId: 'cycle-2', cycleName: 'Fall 2026' };
    const data: RowPeriodData<HoursItem> = {
      first: { '2026-08-09': [entry('entry-1', 'meeting'), otherCycle] },
    };

    const { result } = renderHook(() => useHoursCalendarData(data, [], [], [], 'cycle-1'));

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-1' })]);
  });

  it('discards cached resource results when the filter contract changes', () => {
    const periods = {
      '2026-08-09': [entry('entry-1', 'meeting'), entry('entry-2', 'other')],
    };
    const data: RowPeriodData<HoursItem> = { first: periods };
    const { result, rerender } = renderHook(
      ({ categories }) => useHoursCalendarData(data, categories, [], []),
      { initialProps: { categories: ['meeting'] } },
    );

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-1' })]);

    rerender({ categories: ['other'] });

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-2' })]);
  });

  it('filters entries by Task, Session, and Regular linkage type', () => {
    const data: RowPeriodData<HoursItem> = {
      first: { '2026-08-09': [
        { ...entry('task-entry', 'meeting'), taskId: 'task-1' },
        { ...entry('session-entry', 'meeting'), sessionId: 'session-1' },
        entry('other-entry', 'meeting'),
      ] },
    };

    const { result } = renderHook(() => useHoursCalendarData(data, [], [], ['session']));

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'session-entry' })]);
  });
});
