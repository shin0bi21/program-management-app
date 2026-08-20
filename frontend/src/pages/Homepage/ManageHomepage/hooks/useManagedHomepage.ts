import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getErrorMessage } from '../../../../http/clientErrors';

import {
  deleteHomepageImage,
  getManagedHomepage,
  reorderHomepageImages,
} from '../manageHomepage.api';

const queryKey = ['homepage', 'managed'] as const;

export function useManagedHomepage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getManagedHomepage({ signal }),
  });
  const images = query.data?.images ?? [];

  const refresh = async () => {
    setActionError(null);
    await query.refetch();
  };

  const deleteImage = async (imageId: string) => {
    await deleteHomepageImage(imageId);
    await refresh();
  };

  const reorderImages = async (sourceImageId: string, targetImageId: string) => {
    if (sourceImageId === targetImageId) return;

    const reordered = [...images];
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
      setActionError(getErrorMessage(cause, 'Could not save image order'));
      await query.refetch();
    }
  };

  return {
    images,
    loading: query.isLoading,
    error: actionError ?? (query.error
      ? getErrorMessage(query.error, 'Could not load homepage management')
      : null),
    refresh,
    deleteImage,
    reorderImages,
  };
}
