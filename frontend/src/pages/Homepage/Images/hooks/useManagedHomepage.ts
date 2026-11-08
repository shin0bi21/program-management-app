import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getErrorMessage } from '../../../../http/errors';
import type { ManagedHomepageImage } from '../types';

import {
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
} from '../manageHomepage.api';

const queryKey = ['homepage', 'managed', 'images'] as const;

/**
 * Owns the managed image collection and reconciles image saves, deletion, and ordering.
 * Saved records update the cache; reorder and delete retain their server-read recovery.
 * @example const { images, saveImage } = useManagedHomepage(); // render saved images and reconcile a modal save
 */
export function useManagedHomepage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const reorderInFlight = useRef(false);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getManagedHomepage({ signal }),
    enabled: !reordering,
  });
  const images = query.data?.images ?? [];

  /**
   * Retries the managed collection read when an order mutation is not in progress.
   * @example await refresh() // reloads saved images
   */
  const refresh = async () => {
    if (reorderInFlight.current) return;

    setActionError(null);
    await query.refetch();
  };

  /**
   * Cancels older reads before reconciling a saved image; loads the collection if it is not cached.
   * @param savedImage - Authoritative normalized image returned by create or update.
   * @example await saveImage(savedImage) // replaces its loaded row without fetching the collection
   */
  const saveImage = async (savedImage: ManagedHomepageImage) => {
    await queryClient.cancelQueries({ queryKey, exact: true });
    const cached = queryClient.getQueryData<{ images: ManagedHomepageImage[] }>(queryKey);
    if (!cached) {
      // A saved row cannot establish membership for a collection that has never loaded.
      await queryClient.invalidateQueries({ queryKey, exact: true });
      return;
    }

    queryClient.setQueryData<{ images: ManagedHomepageImage[] }>(queryKey, current => {
      const currentImages = current?.images ?? cached.images;
      const exists = currentImages.some(image => image.id === savedImage.id);
      return {
        images: exists
          ? currentImages.map(image => image.id === savedImage.id ? savedImage : image)
          : [...currentImages, savedImage],
      };
    });
    setActionError(null);
  };

  /**
   * Deletes a confirmed image and reloads the remaining server order.
   * @param imageId - Saved image selected for deletion.
   * @example await deleteImage('image-1') // deletes and refreshes the collection
   */
  const deleteImage = async (imageId: string) => {
    if (reorderInFlight.current) return;

    await deleteHomepageImage(imageId);
    await refresh();
  };

  /**
   * Moves an image optimistically, saving the order and recovering from failed writes or reads.
   * @param sourceImageId - Image being moved within the loaded collection.
   * @param targetImageId - Image whose position should receive the moved image.
   * @example await reorderImages('image-2', 'image-1') // moves image-2 to image-1's position
   */
  const reorderImages = async (sourceImageId: string, targetImageId: string) => {
    if (reorderInFlight.current || sourceImageId === targetImageId) return;

    reorderInFlight.current = true;
    setReordering(true);
    const previousImages = queryClient.getQueryData<{ images: typeof images }>(queryKey)?.images ?? images;

    try {
      // Stop a read started before the optimistic update from restoring its older order.
      await queryClient.cancelQueries({ queryKey, exact: true });

      const currentImages = queryClient.getQueryData<{ images: typeof images }>(queryKey)?.images ?? images;
      const reordered = [...currentImages];
      const fromIndex = reordered.findIndex((image) => image.id === sourceImageId);
      const targetIndex = reordered.findIndex((image) => image.id === targetImageId);
      if (fromIndex < 0 || targetIndex < 0) return;

      const [moved] = reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      const orderedImages = reordered.map((image, displayOrder) => ({ ...image, displayOrder }));
      queryClient.setQueryData(queryKey, { images: orderedImages });
      setActionError(null);

      try {
        await reorderHomepageImages(orderedImages.map((image) => image.id));
      } catch (cause) {
        queryClient.setQueryData(queryKey, { images: previousImages });
        setActionError(getErrorMessage(cause, 'Could not save image order'));

        try {
          await query.refetch({ throwOnError: true });
        } catch {
          // Retain the save error and the last usable order if recovery also fails.
        }

        return;
      }

      try {
        await queryClient.cancelQueries({ queryKey, exact: true });
        await query.refetch({ throwOnError: true });
      } catch (cause) {
        // The server saved this order; a failed read must not roll it back.
        setActionError(`Image order saved. ${getErrorMessage(cause, 'Could not refresh images')}`);
      }
    } finally {
      reorderInFlight.current = false;
      setReordering(false);
    }
  };

  return {
    images,
    loading: query.isLoading,
    reordering,
    error: actionError ?? (query.error
      ? getErrorMessage(query.error, 'Could not load homepage management')
      : null),
    refresh,
    saveImage,
    deleteImage,
    reorderImages,
  };
}
