import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import type { LeadPreference } from '../types';
import { useLeadControls } from './useLeadControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as LeadPreference | null,
  loading: false,
  error: null as string | null,
  setBaseline: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../../../common/features/preferences/hooks/useUserPreference', () => ({
  default: () => preferenceHook,
}));

const programs: Program[] = [{
  id: 'program-1',
  name: 'Soft Skills',
  description: null,
  rosterMode: 'enrolled',
  minAge: 12,
  maxAge: 15,
}];
const columnKeys = ['firstName', 'lastName', 'school', 'program', 'status', 'created'];

describe('useLeadControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: LeadPreference = {
      statuses: [],
      programIds: [],
      sorting: { key: 'createdAt', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: LeadPreference) => LeadPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => useLeadControls(programs, false, null, columnKeys));
    await waitFor(() => expect(result.current.queryFilters).not.toBeNull());

    act(() => {
      result.current.setHiddenColumns(['school']);
      result.current.setColumnWidths({ firstName: 240 });
    });

    expect(persisted.hiddenColumns).toEqual(['school']);
    expect(persisted.columnWidths).toEqual({ firstName: 240 });
  });
});
