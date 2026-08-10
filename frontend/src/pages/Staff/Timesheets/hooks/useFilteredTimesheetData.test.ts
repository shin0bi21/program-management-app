import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFilteredTimesheetData } from './useFilteredTimesheetData';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { TimesheetItem } from '../types';

const entry = (id: string, task: TimesheetItem['task']): TimesheetItem => ({
  id,
  programId: null,
  programName: null,
  cohortId: null,
  cohortName: null,
  task,
  label: task,
  hours: 1,
  note: id,
});

describe('useFilteredTimesheetData', () => {
  it('preserves filtered data references for unchanged resources', () => {
    const firstResource = { '2026-08-09': [entry('entry-1', 'meeting')] };
    const secondResource = { '2026-08-09': [entry('entry-2', 'meeting')] };
    const initial: ResourcePeriodData<TimesheetItem> = { first: firstResource, second: secondResource };
    const { result, rerender } = renderHook(
      ({ data }) => useFilteredTimesheetData(data, ['meeting'], []),
      { initialProps: { data: initial } },
    );
    const previousSecond = result.current.second;

    rerender({ data: { first: { '2026-08-09': [entry('entry-1', 'other')] }, second: secondResource } });

    expect(result.current.second).toBe(previousSecond);
    expect(result.current.first['2026-08-09']).toEqual([]);
  });
});
