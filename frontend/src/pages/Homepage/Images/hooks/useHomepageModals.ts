import { useState } from 'react';

import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';

import type { ManagedHomepageImage } from '../types';

interface UseHomepageModalsOptions {
  deleteImage: (imageId: string) => Promise<void>;
}

/**
 * Owns the active image target and captured deletion confirmation for this page.
 * @param options - Action that removes the confirmed saved image.
 * @example useHomepageModals({ deleteImage }).image.openNew() // opens an empty upload form
 */
export function useHomepageModals({ deleteImage }: UseHomepageModalsOptions) {
  const [imageTarget, setImageTarget] = useState<ManagedHomepageImage | 'new' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const openNewImage = () => setImageTarget('new');
  const openImage = (image: ManagedHomepageImage) => setImageTarget(image);
  const closeImage = () => setImageTarget(null);

  const confirmDeleteImage = (image: ManagedHomepageImage) => setConfirmAction({
    title: 'Delete Homepage Image',
    message: `Delete “${image.caption}”? This cannot be undone.`,
    confirmVariant: 'danger',
    successMessage: 'Homepage image deleted',
    onConfirm: () => deleteImage(image.id),
  });

  const closeConfirmation = () => setConfirmAction(null);

  return {
    image: {
      target: imageTarget === 'new' ? null : imageTarget,
      open: imageTarget !== null,
      openNew: openNewImage,
      openEdit: openImage,
      close: closeImage,
    },
    deletion: {
      action: confirmAction,
      open: confirmDeleteImage,
      close: closeConfirmation,
    },
  };
}
