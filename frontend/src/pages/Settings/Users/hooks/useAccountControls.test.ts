import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountPreference } from '../types';
import { useAccountControls } from './useAccountControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as AccountPreference | null,
  loading: false,
  error: null as string | null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const columnKeys = ['name', 'email', 'role', 'status', 'createdAt'];

describe('useAccountControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: AccountPreference = {
      statuses: [],
      roles: [],
      sorting: { key: 'name', direction: 'asc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: AccountPreference) => AccountPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useAccountControls(true, columnKeys));
    await waitFor(() => expect(preferenceHook.setBaseline).toHaveBeenCalled());

    act(() => {
      result.current.setHiddenColumns(['email']);
      result.current.setColumnWidths({ name: 240 });
    });

    expect(persisted.hiddenColumns).toEqual(['email']);
    expect(persisted.columnWidths).toEqual({ name: 240 });
  });
});
