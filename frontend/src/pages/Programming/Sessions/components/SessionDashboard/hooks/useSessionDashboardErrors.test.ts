import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useSessionDashboardErrors } from './useSessionDashboardErrors';

describe('useSessionDashboardErrors', () => {
  it('aggregates card errors and clears the page owner on unmount', () => {
    const onErrorsChange = vi.fn();
    const { result, unmount } = renderHook(() => useSessionDashboardErrors(onErrorsChange));

    act(() => result.current.setNotesError({ message: 'Could not load notes' }));
    act(() => result.current.setAttachmentsError({ message: 'Could not load attachments' }));

    expect(onErrorsChange).toHaveBeenLastCalledWith([
      { message: 'Could not load notes' },
      { message: 'Could not load attachments' },
    ]);

    unmount();
    expect(onErrorsChange).toHaveBeenLastCalledWith([]);
  });
});
