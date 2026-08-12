import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFilteredTimesheetData } from './useFilteredTimesheetData';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { TimesheetItem } from '../../../../common/features/timeEntries/types';

const entry = (id: string, category: TimesheetItem['category']): TimesheetItem => ({
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

describe('useFilteredTimesheetData', () => {
  it('returns the source object unchanged when no filters are active', () => {
    const data: ResourcePeriodData<TimesheetItem> = {
      first: { '2026-08-09': [entry('entry-1', 'meeting')] },
    };

    const { result } = renderHook(() => useFilteredTimesheetData(data, [], [], []));

    expect(result.current).toBe(data);
  });

  it('preserves filtered data references for unchanged resources', () => {
    const firstResource = { '2026-08-09': [entry('entry-1', 'meeting')] };
    const secondResource = { '2026-08-09': [entry('entry-2', 'meeting')] };
    const initial: ResourcePeriodData<TimesheetItem> = { first: firstResource, second: secondResource };
    const { result, rerender } = renderHook(
      ({ data }) => useFilteredTimesheetData(data, ['meeting'], [], []),
      { initialProps: { data: initial } },
    );
    const previousSecond = result.current.second;

    rerender({ data: { first: { '2026-08-09': [entry('entry-1', 'other')] }, second: secondResource } });

    expect(result.current.second).toBe(previousSecond);
    expect(result.current.first['2026-08-09']).toEqual([]);
  });

  it('filters entries by their stored cycle ID', () => {
    const otherCycle = { ...entry('entry-2', 'meeting'), cycleId: 'cycle-2', cycleName: 'Fall 2026' };
    const data: ResourcePeriodData<TimesheetItem> = {
      first: { '2026-08-09': [entry('entry-1', 'meeting'), otherCycle] },
    };

    const { result } = renderHook(() => useFilteredTimesheetData(data, [], [], [], 'cycle-1'));

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-1' })]);
  });

  it('discards cached resource results when the filter contract changes', () => {
    const periods = {
      '2026-08-09': [entry('entry-1', 'meeting'), entry('entry-2', 'other')],
    };
    const data: ResourcePeriodData<TimesheetItem> = { first: periods };
    const { result, rerender } = renderHook(
      ({ categories }) => useFilteredTimesheetData(data, categories, [], []),
      { initialProps: { categories: ['meeting'] } },
    );

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-1' })]);

    rerender({ categories: ['other'] });

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'entry-2' })]);
  });

  it('filters entries by Task, Session, and Regular linkage type', () => {
    const data: ResourcePeriodData<TimesheetItem> = {
      first: { '2026-08-09': [
        { ...entry('task-entry', 'meeting'), taskId: 'task-1' },
        { ...entry('session-entry', 'meeting'), sessionId: 'session-1' },
        entry('other-entry', 'meeting'),
      ] },
    };

    const { result } = renderHook(() => useFilteredTimesheetData(data, [], [], ['session']));

    expect(result.current.first['2026-08-09']).toEqual([expect.objectContaining({ id: 'session-entry' })]);
  });
});
