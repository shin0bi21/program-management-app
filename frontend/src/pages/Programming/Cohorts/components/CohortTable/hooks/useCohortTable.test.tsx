import { render, renderHook } from '@testing-library/react';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionItem } from '../../../../../../common/components/ActionsMenu/ActionsMenu';
import type { ProgramCohort } from '../../../types';
import useCohortTable from './useCohortTable';

const menu = vi.hoisted<{ items: ActionItem[] }>(() => ({ items: [] }));
vi.mock('../../../../../../common/components/ActionsMenu/ActionsMenu', () => ({
  default: ({ items }: { items: ActionItem[] }) => {
    menu.items = items;
    return <div />;
  },
}));

const cohort = {
  id: 'cohort-1', programId: 'program-1', programName: 'Soft Skills', enrollmentRequired: true,
  cycleId: 'cycle-1', cycleName: 'Summer 2026', name: 'Summer 2026', startsOn: '2026-07-01',
  endsOn: '2026-09-01', state: 'active', minAge: 12, maxAge: 15, enrolledCount: 5,
  nextSessionAt: null, nextSessionId: null, averageAttendance: null, attendanceAttendedCount: 0,
  attendanceRecordedCount: 0, uniqueAttendeeCount: 0,
} as ProgramCohort;

function renderCell(column: ColumnDef<ProgramCohort>, value: ProgramCohort) {
  if (typeof column.cell !== 'function') throw new Error(`Column ${column.id} has no cell renderer`);
  return column.cell({ row: { original: value } } as CellContext<ProgramCohort, unknown>);
}

describe('useCohortTable', () => {
  beforeEach(() => {
    menu.items = [];
    vi.clearAllMocks();
  });

  it('omits management actions for read-only users', () => {
    const { result } = renderHook(() => useCohortTable({
      canWrite: false, canManageRoster: false,
      onManageRoster: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    expect(result.current.some(column => column.id === 'actions')).toBe(false);
  });

  it('maps enrolled-cohort actions and emits exact row callbacks', () => {
    const callbacks = {
      onManageRoster: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
    };
    const { result } = renderHook(() => useCohortTable({ canWrite: true, canManageRoster: true, ...callbacks }));
    const actionColumn = result.current.find(column => column.id === 'actions')!;

    render(<>{renderCell(actionColumn, cohort)}</>);
    menu.items.forEach(item => item.onClick());
    expect(callbacks.onManageRoster).toHaveBeenCalledWith(cohort);
    expect(callbacks.onEdit).toHaveBeenCalledWith(cohort);
    expect(callbacks.onDelete).toHaveBeenCalledWith(cohort);
  });

  it('omits roster management for open-attendance cohorts', () => {
    const { result } = renderHook(() => useCohortTable({
      canWrite: true, canManageRoster: true,
      onManageRoster: vi.fn(),
      onEdit: vi.fn(),
      onDelete: vi.fn(),
    }));

    render(<>{renderCell(result.current.find(column => column.id === 'actions')!, {
      ...cohort,
      enrollmentRequired: false,
    })}</>);
    expect(menu.items.map(item => item.id)).toEqual(['edit', 'delete']);
  });

  it('allows roster-only staff to manage enrollment without assignment edit actions', () => {
    const { result } = renderHook(() => useCohortTable({
      canWrite: false, canManageRoster: true,
      onManageRoster: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn(),
    }));
    const actions = result.current.find(column => column.id === 'actions')!;

    render(<>{renderCell(actions, cohort)}</>);
    expect(menu.items.map(item => item.id)).toEqual(['manage-roster']);
    expect(renderCell(actions, { ...cohort, enrollmentRequired: false })).toBeNull();
  });
});
