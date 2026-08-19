// Scope: serializes direct form submissions without owning workflow state.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import useSubmitLock from './useSubmitLock';

describe('useSubmitLock', () => {
  it('blocks a second submission until the current one releases the lock', () => {
    const { result } = renderHook(() => useSubmitLock());

    expect(result.current.tryLock()).toBe(true);
    expect(result.current.tryLock()).toBe(false);

    result.current.unlock();
    expect(result.current.tryLock()).toBe(true);
  });
});
