import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import type { CohortPreference } from '../types';
import { useCohortControls } from './useCohortControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as CohortPreference | null,
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
const columnKeys = ['program', 'cohort', 'start', 'end', 'status'];

describe('useCohortControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: CohortPreference = {
      programId: null,
      status: null,
      sorting: { key: 'start', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((update: (current: CohortPreference) => CohortPreference) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => (
      useCohortControls('admin', programs, false, columnKeys, null)
    ));
    await waitFor(() => expect(preferenceHook.setBaseline).toHaveBeenCalled());

    act(() => {
      result.current.setHiddenColumns(['status']);
      result.current.setColumnWidths({ cohort: 240 });
    });

    expect(persisted.hiddenColumns).toEqual(['status']);
    expect(persisted.columnWidths).toEqual({ cohort: 240 });
  });
});
