import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSchool } from '../schoolModal.api';
import useSchoolModal from './useSchoolModal';

vi.mock('../schoolModal.api', () => ({
  createSchool: vi.fn(),
  deleteSchool: vi.fn(),
  setSchool: vi.fn(),
}));

describe('useSchoolModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks another create command while the first is pending', async () => {
    const action = { type: 'add' as const };
    let resolveCreate!: (value: { id: string; name: string }) => void;
    vi.mocked(createSchool).mockReturnValue(new Promise(resolve => { resolveCreate = resolve; }) as never);
    const { result } = renderHook(() => useSchoolModal({
      action,
      onUpsert: vi.fn(),
      onDelete: vi.fn(),
    }));
    act(() => result.current.setName('Central High'));

    let first!: Promise<void>;
    act(() => {
      first = result.current.submit();
      void result.current.submit();
    });

    expect(createSchool).toHaveBeenCalledTimes(1);
    await act(async () => resolveCreate({ id: 'school-1', name: 'Central High' }));
    await first;
  });
});
