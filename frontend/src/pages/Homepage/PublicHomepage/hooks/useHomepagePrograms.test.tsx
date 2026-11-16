import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicHomepagePrograms } from '../publicHomepage.api';
import { useHomepagePrograms } from './useHomepagePrograms';

vi.mock('../publicHomepage.api', () => ({ getPublicHomepagePrograms: vi.fn() }));

const program = {
  id: 'program-1',
  title: 'Future Ready',
  description: 'Build confidence and communication skills.',
  enrollmentRequired: true,
  minAge: 12,
  maxAge: 15,
  sessions: [],
};

describe('useHomepagePrograms', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the public program query lifecycle and refresh action', async () => {
    vi.mocked(getPublicHomepagePrograms).mockResolvedValue({ programs: [program] });
    const { result } = renderHook(useHomepagePrograms, { wrapper: createQueryClientWrapper(createTestQueryClient()) });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.programs).toEqual([program]));
    expect(result.current.error).toBeNull();

    await result.current.refresh();
    expect(getPublicHomepagePrograms).toHaveBeenCalledTimes(2);
  });
});
