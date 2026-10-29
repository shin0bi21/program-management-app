import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ProgramCohort } from '../../types';
import useCohortSelection from './useCohortSelection';

const cohort = { id: 'cohort-1' } as ProgramCohort;

describe('useCohortSelection', () => {
  it('reconciles a selected cohort without switching to another edited row', () => {
    const { result } = renderHook(() => useCohortSelection());
    act(() => result.current.setSelectedCohort(cohort));

    act(() => result.current.syncSelectedCohort({ ...cohort, id: 'another-cohort' }));
    expect(result.current.selectedCohort).toBe(cohort);

    const saved = { ...cohort, enrolledCount: 6 };
    act(() => result.current.syncSelectedCohort(saved));
    expect(result.current.selectedCohort).toBe(saved);
  });

  it('clears only the selected cohort when that cohort is removed', () => {
    const { result } = renderHook(() => useCohortSelection());

    act(() => result.current.setSelectedCohort(cohort));
    act(() => result.current.removeSelectedCohort('another-cohort'));
    expect(result.current.selectedCohort).toBe(cohort);

    act(() => result.current.removeSelectedCohort(cohort.id));
    expect(result.current.selectedCohort).toBeNull();
  });
});
