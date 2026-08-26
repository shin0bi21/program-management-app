import { useState } from 'react';

import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import { type ConfirmAction } from '../../../common/components/ConfirmModal/types';
import PageHeader from '../../../common/components/PageHeader/PageHeader';

import HomepageImageList from './components/HomepageImageList/HomepageImageList';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { useManagedHomepage } from './hooks/useManagedHomepage';

import type { ManagedHomepageImage } from './types';

import './ManageHomepage.css';

export default function ManageHomepage() {
  const homepage = useManagedHomepage();
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<ManagedHomepageImage | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const openAddImage = () => {
    setImageTarget(null);
    setImageModalOpen(true);
  };

  const openEditImage = (image: ManagedHomepageImage) => {
    setImageTarget(image);
    setImageModalOpen(true);
  };

  const confirmDeleteImage = (image: ManagedHomepageImage) => setConfirmAction({
    title: 'Delete Homepage Image',
    message: `Delete “${image.caption}”? This cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    successMessage: 'Homepage image deleted',
    onConfirm: () => homepage.deleteImage(image.id),
  });

  return (
    <>
      <div className="page-container homepage-management-page">
        <PageHeader title="Manage Homepage" />

        <div className="homepage-management-content">
          <HomepageImageList
            images={homepage.images}
            loading={homepage.loading}
            error={homepage.error}
            onAdd={openAddImage}
            onEdit={openEditImage}
            onDelete={confirmDeleteImage}
            onReorder={homepage.reorderImages}
          />
        </div>
      </div>

      <HomepageImageModal
        image={imageTarget}
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSaved={homepage.refresh}
      />

      <ConfirmModal
        action={confirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </>
  );
}
