import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import useViewFileModal from './useViewFileModal';

function options(overrides: Partial<Parameters<typeof useViewFileModal>[0]> = {}) {
  return {
    isOpen: true,
    requestKey: 'file-1',
    title: 'Report',
    mimeType: 'application/pdf',
    onClose: vi.fn(),
    loadFile: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    formatLoadError: () => 'Could not load file.',
    ...overrides,
  };
}

describe('useViewFileModal', () => {
  it('loads a previewable file and returns a complete viewer prop bundle', async () => {
    const loadFile = vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    const { result } = renderHook(() => useViewFileModal(options({ loadFile })));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.file).toBeInstanceOf(Blob));

    expect(loadFile).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result.current).toEqual(expect.objectContaining({
      isOpen: true,
      title: 'Report',
      mimeType: 'application/pdf',
      loading: false,
      error: null,
    }));
  });

  it('cancels stale loads and resets when the viewer closes', async () => {
    let resolveFirst: ((file: Blob) => void) | undefined;
    const firstLoad = new Promise<Blob>(resolve => { resolveFirst = resolve; });
    const secondFile = new Blob(['second'], { type: 'application/pdf' });
    const loadFile = vi.fn()
      .mockReturnValueOnce(firstLoad)
      .mockResolvedValueOnce(secondFile);
    const { result, rerender } = renderHook(
      ({ requestKey, isOpen }) => useViewFileModal(options({ requestKey, isOpen, loadFile })),
      { initialProps: { requestKey: 'file-1', isOpen: true } },
    );

    rerender({ requestKey: 'file-2', isOpen: true });
    expect(result.current.file).toBeNull();

    await waitFor(() => expect(result.current.file).toBeInstanceOf(Blob));
    act(() => resolveFirst?.(new Blob(['first'], { type: 'application/pdf' })));
    expect(result.current.file).toBe(secondFile);

    rerender({ requestKey: 'file-2', isOpen: false });
    expect(result.current.file).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('hides the previous file synchronously when the request key changes', async () => {
    let resolveSecond: ((file: Blob) => void) | undefined;
    const firstFile = new Blob(['first'], { type: 'application/pdf' });
    const secondFile = new Blob(['second'], { type: 'application/pdf' });
    const loadFile = vi.fn()
      .mockResolvedValueOnce(firstFile)
      .mockReturnValueOnce(new Promise<Blob>(resolve => { resolveSecond = resolve; }));
    const { result, rerender } = renderHook(
      ({ requestKey }) => useViewFileModal(options({ requestKey, loadFile })),
      { initialProps: { requestKey: 'file-1' } },
    );

    await waitFor(() => expect(result.current.file).toBe(firstFile));

    rerender({ requestKey: 'file-2' });
    expect(result.current.file).toBeNull();

    act(() => resolveSecond?.(secondFile));
    await waitFor(() => expect(result.current.file).toBe(secondFile));
  });

  it('skips loading unsupported files and formats load failures', async () => {
    const unsupportedLoader = vi.fn();
    const unsupported = renderHook(() => useViewFileModal(options({
      mimeType: 'application/msword',
      loadFile: unsupportedLoader,
    })));
    expect(unsupportedLoader).not.toHaveBeenCalled();
    expect(unsupported.result.current.loading).toBe(false);

    const failed = renderHook(() => useViewFileModal(options({
      loadFile: vi.fn().mockRejectedValue(new Error('failed')),
    })));
    await waitFor(() => expect(failed.result.current.error).toBe('Could not load file.'));
  });
});
