// This suite owns the mapping from virtual row indexes to the retained row slice.
import { renderHook } from '@testing-library/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRowVirtualization } from './useRowVirtualization';

vi.mock('@tanstack/react-virtual', () => ({ useVirtualizer: vi.fn() }));

describe('useRowVirtualization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the row slice represented by the virtual rows', () => {
    vi.mocked(useVirtualizer).mockReturnValue({
      getVirtualItems: () => [
        { index: 1, key: '1', start: 92, end: 184, size: 92, lane: 0 },
        { index: 2, key: '2', start: 184, end: 276, size: 92, lane: 0 },
      ],
    } as never);
    const rows = ['Alex', 'Bilal', 'Zoe', 'Mina'];
    const viewportRef = { current: document.createElement('div') };

    const { result } = renderHook(() => useRowVirtualization(
      rows,
      viewportRef,
      92,
      40,
      3,
    ));

    expect(result.current).toEqual({ first: 1, last: 3, rows: ['Bilal', 'Zoe'] });
    expect(useVirtualizer).toHaveBeenCalledWith(expect.objectContaining({
      count: 4,
      overscan: 3,
      scrollMargin: 40,
    }));
  });

  it('returns an empty slice before the virtualizer exposes rows', () => {
    vi.mocked(useVirtualizer).mockReturnValue({ getVirtualItems: () => [] } as never);

    const { result } = renderHook(() => useRowVirtualization(
      ['Alex'],
      { current: null },
      92,
      40,
      3,
    ));

    expect(result.current).toEqual({ first: 0, last: 0, rows: [] });
  });
});
