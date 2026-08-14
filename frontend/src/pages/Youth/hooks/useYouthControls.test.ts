import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PreferenceValues } from '../../../common/features/preferences/api/preferences.api';
import type { Program } from '../../../common/features/programs/types';
import { useYouthControls } from './useYouthControls';

const preferenceHook = vi.hoisted<{
  preference: PreferenceValues['youth-profile-filters'] | null;
  loading: boolean;
  error: string | null;
  save: ReturnType<typeof vi.fn>;
}>(() => ({ preference: null, loading: false, error: null, save: vi.fn() }));

vi.mock('../../../common/features/preferences/hooks/useUserPreference', () => ({
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

describe('useYouthControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    preferenceHook.preference = null;
    preferenceHook.loading = false;
    preferenceHook.error = null;
  });

  it('waits for the authenticated role before applying staff defaults', async () => {
    const { result, rerender } = renderHook(
      ({ role }: { role: string | null }) => useYouthControls({
        role,
        programs,
        programsLoading: false,
      }),
      { initialProps: { role: null as string | null } },
    );

    expect(result.current.queryFilters).toBeNull();

    rerender({ role: 'staff' });

    await waitFor(() => expect(result.current.queryFilters).toEqual({
      search: '',
      statuses: ['active'],
      programIds: ['program-1'],
    }));
  });
});
