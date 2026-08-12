import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { timesheetEntryType } from '../../../timesheetViewData';
import { buildTimesheetListRows, useTimesheetListData } from './useTimesheetListData';

const item = {
  id: 'entry-1', programId: null, programName: null, cycleId: 'cycle-1', cycleName: 'Summer 2026',
  category: 'meeting' as const, categoryLabel: 'Meeting', taskId: null, taskTitle: null,
  sessionId: null, sessionLabel: null, hours: 2, note: 'Planning',
};

describe('useTimesheetListData', () => {
  it.each([
    [{ ...item, taskId: 'task-1' }, 'Task'],
    [{ ...item, sessionId: 'session-1' }, 'Session'],
    [item, 'Regular'],
  ])('derives the persisted entry type from its linkage', (entry, expected) => {
    expect(timesheetEntryType(entry)).toBe(expected);
  });

  it('fails loudly when entry data references an unknown staff resource', () => {
    expect(() => buildTimesheetListRows(
      { 'missing-staff': { '2026-08-11': [item] } },
      [],
      [],
    )).toThrow('Timesheet data references unknown staff resource missing-staff.');
  });

  it('searches session labels alongside the established entry fields', () => {
    const { result } = renderHook(() => useTimesheetListData(
      { 'staff-1': { '2026-08-11': [{ ...item, sessionId: 'session-1', sessionLabel: 'Robotics lab' }] } },
      [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      [],
      'robotics',
      { key: 'date', direction: 'desc' },
    ));
    expect(result.current).toHaveLength(1);
  });

  it('keeps separate staff names for list columns and a combined name for search', () => {
    const rows = buildTimesheetListRows(
      { 'staff-1': { '2026-08-11': [item] } },
      [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      [],
    );

    expect(rows[0]).toEqual(expect.objectContaining({
      staffFirstName: 'Zoe', staffLastName: 'Wilson', staffName: 'Zoe Wilson',
    }));
    const { result } = renderHook(() => useTimesheetListData(
      { 'staff-1': { '2026-08-11': [item] } },
      [{ id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true }],
      [],
      'zoe wilson',
      { key: 'date', direction: 'desc' },
    ));
    expect(result.current).toHaveLength(1);
  });

  it('sorts rows by the selected column with an entry ID tie-breaker', () => {
    const { result } = renderHook(() => useTimesheetListData(
      {
        'staff-1': { '2026-08-10': [{ ...item, id: 'entry-2', hours: 5 }] },
        'staff-2': { '2026-08-11': [{ ...item, id: 'entry-1', hours: 1 }] },
      },
      [
        { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
        { id: 'staff-2', firstName: 'Alex', lastName: 'Smith', name: 'Alex Smith', role: 'staff', writable: true },
      ],
      [],
      '',
      { key: 'hours', direction: 'asc' },
    ));

    expect(result.current.map(row => row.id)).toEqual(['entry-1', 'entry-2']);
  });
});
