import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../../../../common/features/programs/types';
import type { ExpressionInterestPreference } from '../types';
import { useExpressionOfInterestControls } from './useExpressionOfInterestControls';

const preferenceHook = vi.hoisted(() => ({
  preference: null as ExpressionInterestPreference | null,
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
const columnKeys = [
  'firstName', 'lastName', 'age', 'school', 'program', 'submittedByRole', 'submittedAt', 'status',
];
const sortKeys = ['name', 'age', 'school', 'program', 'submittedByRole', 'createdAt', 'status'] as const;

describe('useExpressionOfInterestControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
  });

  it('preserves hidden columns when a resize follows immediately', async () => {
    const persisted: ExpressionInterestPreference = {
      statuses: [],
      programIds: [],
      sorting: { key: 'createdAt', direction: 'desc' },
      columnWidths: {},
      hiddenColumns: [],
    };
    preferenceHook.save.mockImplementation((
      update: (current: ExpressionInterestPreference) => ExpressionInterestPreference,
    ) => {
      Object.assign(persisted, update(persisted));
    });
    const { result } = renderHook(() => (
      useExpressionOfInterestControls(programs, false, null, columnKeys, sortKeys)
    ));
    await waitFor(() => expect(result.current.queryFilters).not.toBeNull());

    act(() => {
      result.current.setHiddenColumns(['school']);
      result.current.setColumnWidths({ firstName: 240 });
      result.current.setSorting({ key: 'school', direction: 'asc' });
    });

    expect(persisted.hiddenColumns).toEqual(['school']);
    expect(persisted.columnWidths).toEqual({ firstName: 240 });
    expect(persisted.sorting).toEqual({ key: 'school', direction: 'asc' });
  });

  it('scrubs removed programs and obsolete sorting before establishing the baseline', async () => {
    preferenceHook.preference = {
      statuses: ['new'],
      programIds: ['removed-program'],
      sorting: { key: 'removedColumn' as never, direction: 'asc' },
    };
    const { result } = renderHook(() => (
      useExpressionOfInterestControls(programs, false, null, columnKeys, sortKeys)
    ));

    await waitFor(() => expect(result.current.ready).toBe(true));

    expect(result.current.programFilters).toEqual([]);
    expect(result.current.sorting).toEqual({ key: 'createdAt', direction: 'desc' });
    expect(preferenceHook.setBaseline).toHaveBeenCalledWith(expect.objectContaining({
      programIds: [],
      sorting: { key: 'createdAt', direction: 'desc' },
    }));
  });
});
