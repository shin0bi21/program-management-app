import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useHeroPhotoCarousel } from './useHeroPhotoCarousel';

const photos = [
  { src: '/one.webp', alt: 'One', caption: 'One.' },
  { src: '/two.webp', alt: 'Two', caption: 'Two.' },
];

describe('useHeroPhotoCarousel', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('cycles automatically, supports direct navigation, and clears its interval', () => {
    vi.useFakeTimers();
    const clearInterval = vi.spyOn(window, 'clearInterval');
    const { result, unmount } = renderHook(() => useHeroPhotoCarousel({ photos }));

    expect(result.current.activePhoto).toEqual(photos[0]);
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.activePhoto).toEqual(photos[1]);
    act(() => result.current.goToNextPhoto());
    expect(result.current.activePhoto).toEqual(photos[0]);

    unmount();
    expect(clearInterval).toHaveBeenCalled();
  });
});
