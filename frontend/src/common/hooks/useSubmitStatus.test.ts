// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getSubmitStatusMessage } from './useSubmitStatus';

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
