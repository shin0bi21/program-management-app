import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getSubmitStatusMessage, useSubmitStatus } from './useSubmitStatus';

describe('getSubmitStatusMessage', () => {
  const messages = {
    submitting: 'Saving...',
    success: 'Saved!',
  };

  it('maps the submission lifecycle to its configured message', () => {
    expect(getSubmitStatusMessage('idle', '', messages)).toBeUndefined();
    expect(getSubmitStatusMessage('submitting', '', messages)).toBe('Saving...');
    expect(getSubmitStatusMessage('success', '', messages)).toBe('Saved!');
    expect(getSubmitStatusMessage('error', 'Save failed', messages)).toBe('Save failed');
  });
});

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
