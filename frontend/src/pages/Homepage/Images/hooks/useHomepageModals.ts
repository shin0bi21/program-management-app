import { useState } from 'react';

import type { ConfirmAction } from '../../../../common/components/ConfirmModal/types';

import type { ManagedHomepageImage } from '../types';

interface UseHomepageModalsOptions {
  deleteImage: (imageId: string) => Promise<void>;
}

export function useHomepageModals({ deleteImage }: UseHomepageModalsOptions) {
  const [imageTarget, setImageTarget] = useState<ManagedHomepageImage | null>(null);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const openNewImage = () => {
    setImageTarget(null);
    setImageModalOpen(true);
  };

  const openImage = (image: ManagedHomepageImage) => {
    setImageTarget(image);
    setImageModalOpen(true);
  };

  const closeImage = () => setImageModalOpen(false);

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
      target: imageTarget,
      open: imageModalOpen,
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
