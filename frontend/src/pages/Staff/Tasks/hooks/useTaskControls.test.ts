import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskOptions } from '../../../../common/features/tasks/types';
import type { TaskPreference } from '../types';
import useTaskControls from './useTaskControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as TaskPreference | null,
  loading: false,
  error: null as string | null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const options: TaskOptions = { resources: [], programs: [] };
const columnKeys = [
  'title', 'category', 'firstName', 'lastName', 'program', 'startDate', 'dueDate', 'status',
];

describe('useTaskControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: TaskPreference = {
      view: 'list',
      staffIds: [],
      programIds: [],
      categories: [],
      statuses: [],
      sorting: { key: 'startDate', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: TaskPreference) => TaskPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useTaskControls(options, false, columnKeys));
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.changeHiddenColumns(['program']);
      result.current.changeColumnWidths({ title: 240 });
    });

    expect(persisted.hiddenColumns).toEqual(['program']);
    expect(persisted.columnWidths).toEqual({ title: 240 });
  });
});
