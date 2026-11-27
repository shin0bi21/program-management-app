import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getHoursReferenceData } from '../../hours.api';
import {
  createQueryClientWrapper,
  createTestQueryClient,
} from '../../../../../tests/queryClientTestUtils';
import useHoursReferenceData from './useHoursReferenceData';

vi.mock('../../hours.api', () => ({ getHoursReferenceData: vi.fn() }));
vi.mock('../../../../../common/features/referenceData/hooks/useReferenceData', () => ({
  useCycleReferences: vi.fn(),
  useProgramReferences: vi.fn(),
  useStaffReferences: vi.fn(),
}));

describe('useHoursReferenceData', () => {
  it('uses the Hours staff scope and requests Hours options', async () => {
    vi.mocked(getHoursReferenceData).mockResolvedValue({ categories: [], types: [] });
    const client = createTestQueryClient();

    renderHook(
      () => useHoursReferenceData(),
      { wrapper: createQueryClientWrapper(client) },
    );

    expect(useStaffReferences).toHaveBeenCalledWith('hours');
    await waitFor(() => expect(getHoursReferenceData).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) }));
  });
});
