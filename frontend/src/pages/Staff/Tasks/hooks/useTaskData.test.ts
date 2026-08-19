// Scope: verifies task options, derived resources, default selection, and resource transitions.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTaskOptions } from '../../../../common/features/tasks/tasks.api';
import { createQueryClientWrapper, createTestQueryClient } from '../../../../tests/queryClientTestUtils';
import useTaskData from './useTaskData';

vi.mock('../../../../common/features/tasks/tasks.api', () => ({
  getTaskOptions: vi.fn(),
}));

const resources = [
  { id: 'staff-read', firstName: 'Read', lastName: 'Only', name: 'Read Only', role: 'staff', writable: false },
  { id: 'staff-1', firstName: 'Zoe', lastName: 'Wilson', name: 'Zoe Wilson', role: 'staff', writable: true },
  { id: 'staff-2', firstName: 'Ana', lastName: 'Diaz', name: 'Ana Diaz', role: 'staff', writable: true },
];

describe('useTaskData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTaskOptions).mockResolvedValue({ resources, programs: [] });
  });

  it('selects the first writable resource and exposes stable derived resources', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskData(['task-options']), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));
    const writableResources = result.current.writableResources;

    expect(result.current.selectedResource?.name).toBe('Zoe Wilson');
    expect(writableResources.map(resource => resource.id)).toEqual(['staff-1', 'staff-2']);

    act(() => result.current.setSelectedResourceId('staff-2'));
    expect(result.current.writableResources).toBe(writableResources);
    expect(result.current.selectedResource?.name).toBe('Ana Diaz');
  });

  it('keeps one page-options query owner across resource transitions', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskData(['task-options']), {
      wrapper: createQueryClientWrapper(client),
    });
    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));

    act(() => result.current.setSelectedResourceId('staff-2'));

    expect(getTaskOptions).toHaveBeenCalledTimes(1);
    expect(result.current.selectedResource?.name).toBe('Ana Diaz');
  });

  it('falls back to the first readable resource when none are writable', async () => {
    vi.mocked(getTaskOptions).mockResolvedValue({ resources: [resources[0]], programs: [] });
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskData(['task-options']), {
      wrapper: createQueryClientWrapper(client),
    });

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-read'));
    expect(result.current.selectedResource?.name).toBe('Read Only');
    expect(result.current.writableResources).toEqual([]);
  });

  it('selects a valid fallback when refreshed options remove the current resource', async () => {
    const client = createTestQueryClient();
    const { result } = renderHook(() => useTaskData(['task-options']), {
      wrapper: createQueryClientWrapper(client),
    });
    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-1'));

    act(() => client.setQueryData(['task-options'], {
      resources: [resources[2]],
      programs: [],
    }));

    await waitFor(() => expect(result.current.selectedResourceId).toBe('staff-2'));
    expect(result.current.selectedResource?.name).toBe('Ana Diaz');
  });
});
