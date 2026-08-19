// Scope: verifies saved option IDs are sanitized against the latest available options.
// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import usePreferenceOptionRecovery from './usePreferenceOptionRecovery';

describe('usePreferenceOptionRecovery', () => {
  it('sanitizes the latest selection when unavailable options recover', () => {
    const onReconcile = vi.fn();
    const { rerender } = renderHook(
      ({ error, selectedIds, availableIds }) => usePreferenceOptionRecovery({
        ready: true,
        loading: false,
        error,
        selectedIds,
        availableIds,
        onReconcile,
      }),
      {
        initialProps: {
          error: true,
          selectedIds: ['program-1', 'removed-program'],
          availableIds: [] as string[],
        },
      },
    );

    rerender({
      error: false,
      selectedIds: ['program-1', 'removed-program'],
      availableIds: ['program-1'],
    });

    expect(onReconcile).toHaveBeenCalledWith(['program-1']);
  });

  it('does not replay the stored selection over an edit made while options were unavailable', () => {
    const onReconcile = vi.fn();
    const { rerender } = renderHook(
      ({ error, selectedIds, availableIds }) => usePreferenceOptionRecovery({
        ready: true,
        loading: false,
        error,
        selectedIds,
        availableIds,
        onReconcile,
      }),
      {
        initialProps: {
          error: true,
          selectedIds: ['saved-program'],
          availableIds: [] as string[],
        },
      },
    );

    rerender({ error: false, selectedIds: [], availableIds: ['saved-program'] });

    expect(onReconcile).not.toHaveBeenCalled();
  });
});
