import { createTestQueryClient, createQueryClientWrapper } from '../../../../tests/queryClientTestUtils';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
} from '../manageHomepage.api';
import { useManagedHomepage } from './useManagedHomepage';

vi.mock('../manageHomepage.api', () => ({
  deleteHomepageImage: vi.fn(),
  getManagedHomepage: vi.fn(),
  reorderHomepageImages: vi.fn(),
}));

const images = [
  {
    id: 'image-1',
    imageUrl: '/image-1.webp',
    mobileUrl: '/image-1-mobile.webp',
    thumbnailUrl: '/image-1-thumbnail.webp',
    altText: 'First image',
    caption: 'First image.',
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'image-2',
    imageUrl: '/image-2.webp',
    mobileUrl: '/image-2-mobile.webp',
    thumbnailUrl: '/image-2-thumbnail.webp',
    altText: 'Second image',
    caption: 'Second image.',
    displayOrder: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('useManagedHomepage', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    vi.mocked(getManagedHomepage).mockResolvedValue({ images });
    vi.mocked(deleteHomepageImage).mockResolvedValue(undefined);
    vi.mocked(reorderHomepageImages).mockResolvedValue({ imageIds: [] });
  });

  it('exposes the managed image query lifecycle and refresh action', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.images).toEqual(images));
    expect(result.current.error).toBeNull();

    await act(() => result.current.refresh());
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });

  it('replaces a saved image, preserves unrelated rows and order, and appends a created image without reads', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));
    const untouched = result.current.images[1];
    const savedImage = {
      ...images[0],
      caption: 'Authoritative caption.',
      altText: 'Server alt text',
      updatedAt: '2026-02-01T00:00:00.000Z',
    };

    await act(() => result.current.saveImage(savedImage));

    expect(result.current.images).toEqual([savedImage, images[1]]);
    expect(result.current.images[1]).toBe(untouched);
    const createdImage = { ...savedImage, id: 'image-3', displayOrder: 2 };
    await act(() => result.current.saveImage(createdImage));

    expect(result.current.images).toEqual([savedImage, images[1], createdImage]);
    expect(result.current.images[1]).toBe(untouched);
    expect(getManagedHomepage).toHaveBeenCalledTimes(1);
  });

  it('loads the complete collection when an image saves before the initial read finishes', async () => {
    let finishInitialRead!: (value: { images: typeof images }) => void;
    vi.mocked(getManagedHomepage).mockImplementationOnce(() => new Promise(resolve => {
      finishInitialRead = resolve;
    }));
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(getManagedHomepage).toHaveBeenCalledTimes(1));
    const savedImage = { ...images[0], id: 'image-3', displayOrder: 2 };
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images: [...images, savedImage] });

    await act(() => result.current.saveImage(savedImage));
    expect(queryClient.getQueryData(['homepage', 'managed', 'images'])).toEqual({
      images: [...images, savedImage],
    });
    await act(async () => {
      finishInitialRead({ images });
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.images).toEqual([...images, savedImage]));
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });

  it('cancels an older collection read before reconciling a saved image', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));
    let finishRead!: (value: { images: typeof images }) => void;
    let readSignal: AbortSignal | undefined;
    vi.mocked(getManagedHomepage).mockImplementationOnce(options => {
      readSignal = options?.signal;
      return new Promise(resolve => { finishRead = resolve; });
    });
    const staleRead = queryClient.fetchQuery({
      queryKey: ['homepage', 'managed', 'images'],
      queryFn: ({ signal }) => getManagedHomepage({ signal }),
    }).catch(() => undefined);
    await waitFor(() => expect(getManagedHomepage).toHaveBeenCalledTimes(2));
    const savedImage = { ...images[0], caption: 'Saved caption.' };

    await act(() => result.current.saveImage(savedImage));
    expect(readSignal?.aborted).toBe(true);
    await act(async () => {
      finishRead({ images });
      await staleRead;
    });

    expect(result.current.images).toEqual([savedImage, images[1]]);
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });

  it('uses a fresh server response after reorder even when the cache has a positive stale time', async () => {
    queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 60_000 } });
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));
    const freshServerImages = [
      { ...images[0], caption: 'Updated by server', displayOrder: 0 },
      { ...images[1], caption: 'Second image.', displayOrder: 1 },
    ];
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images: freshServerImages });

    await act(() => result.current.reorderImages('image-2', 'image-1'));

    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
    expect(result.current.images).toEqual(freshServerImages);
    expect(reorderHomepageImages).toHaveBeenCalledWith(['image-2', 'image-1']);
    expect(result.current.reordering).toBe(false);
  });

  it('locks overlapping reorders, cancels stale reads, and reconciles the server order', async () => {
    let finishReorder!: (value: { imageIds: string[] }) => void;
    vi.mocked(reorderHomepageImages).mockImplementation(() => new Promise((resolve) => { finishReorder = resolve; }));
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    let finishRead!: (value: { images: typeof images }) => void;
    vi.mocked(getManagedHomepage).mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    const staleRead = queryClient.fetchQuery({
      queryKey: ['homepage', 'managed', 'images'],
      queryFn: () => getManagedHomepage(),
    }).catch(() => undefined);
    await waitFor(() => expect(getManagedHomepage).toHaveBeenCalledTimes(2));
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images });

    let reorderPromise!: Promise<void>;
    act(() => { reorderPromise = result.current.reorderImages('image-2', 'image-1'); });
    await waitFor(() => expect(result.current.reordering).toBe(true));
    await act(() => result.current.reorderImages('image-1', 'image-2'));
    expect(reorderHomepageImages).toHaveBeenCalledTimes(1);
    expect(result.current.images.map((image) => image.id)).toEqual(['image-2', 'image-1']);

    finishRead({ images });
    finishReorder({ imageIds: ['image-1', 'image-2'] });
    await act(async () => { await Promise.all([staleRead, reorderPromise]); });

    expect(result.current.images.map((image) => image.id)).toEqual(['image-1', 'image-2']);
    expect(result.current.reordering).toBe(false);
  });

  it('restores the prior order and retains the save error when save and recovery read fail', async () => {
    vi.mocked(reorderHomepageImages).mockRejectedValue(new Error('Save failed'));
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images }).mockRejectedValueOnce(new Error('Read failed'));
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    await act(() => result.current.reorderImages('image-2', 'image-1'));

    expect(result.current.error).toBe('Save failed');
    expect(result.current.images.map((image) => image.id)).toEqual(['image-1', 'image-2']);
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });

  it('keeps the saved order when its refresh fails and retries the read without saving again', async () => {
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images }).mockRejectedValueOnce(new Error('Read failed'));
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    await act(() => result.current.reorderImages('image-2', 'image-1'));

    expect(result.current.images.map(image => image.id)).toEqual(['image-2', 'image-1']);
    expect(result.current.error).toBe('Image order saved. Read failed');
    expect(result.current.reordering).toBe(false);

    const savedImages = [
      { ...images[1], displayOrder: 0 },
      { ...images[0], displayOrder: 1 },
    ];
    vi.mocked(getManagedHomepage).mockResolvedValueOnce({ images: savedImages });
    await act(() => result.current.refresh());

    expect(result.current.images).toEqual(savedImages);
    expect(result.current.error).toBeNull();
    expect(reorderHomepageImages).toHaveBeenCalledTimes(1);
  });

  it('deletes an image and refreshes the managed content', async () => {
    const { result } = renderHook(useManagedHomepage, { wrapper: createQueryClientWrapper(queryClient) });
    await waitFor(() => expect(result.current.images).toEqual(images));

    await act(() => result.current.deleteImage('image-1'));

    expect(deleteHomepageImage).toHaveBeenCalledWith('image-1');
    expect(getManagedHomepage).toHaveBeenCalledTimes(2);
  });
});
