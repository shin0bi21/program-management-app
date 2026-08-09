import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSubmitStatus } from './useSubmitStatus';

describe('useSubmitStatus', () => {
  it('tracks submission state and resets status and error together', () => {
    const { result } = renderHook(() => useSubmitStatus());

    act(() => {
      result.current.setSubmitStatus('error');
      result.current.setError('Save failed');
    });
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Save failed');

    act(() => result.current.resetStatus());
    expect(result.current.submitStatus).toBe('idle');
    expect(result.current.error).toBe('');
  });
});
