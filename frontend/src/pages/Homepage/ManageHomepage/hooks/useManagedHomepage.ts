import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getErrorMessage } from '../../../../http/errors';

import {
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
} from '../manageHomepage.api';

const queryKey = ['homepage', 'managed', 'images'] as const;

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

  const refresh = async () => {
    if (reorderInFlight.current) return;

    setActionError(null);
    await query.refetch();
  };

  const deleteImage = async (imageId: string) => {
    if (reorderInFlight.current) return;

    await deleteHomepageImage(imageId);
    await refresh();
  };

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
    deleteImage,
    reorderImages,
  };
}
