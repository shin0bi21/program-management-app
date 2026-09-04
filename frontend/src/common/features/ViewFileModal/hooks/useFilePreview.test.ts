import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import useFilePreview from './useFilePreview';

describe('useFilePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:file-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  it('creates and releases a preview URL for supported files', async () => {
    const file = new Blob(['pdf'], { type: 'application/pdf' });
    const rendered = renderHook(() => useFilePreview(file, 'application/pdf'));

    await waitFor(() => expect(rendered.result.current.previewUrl).toBe('blob:file-preview'));
    expect(rendered.result.current.canPreview).toBe(true);
    expect(rendered.result.current.isImage).toBe(false);

    rendered.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file-preview');
  });
});
