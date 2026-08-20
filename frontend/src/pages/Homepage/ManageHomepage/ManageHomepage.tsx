import { useState } from 'react';

import Modal from '../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../common/components/Modal/hooks/useConfirmModal';
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
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

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

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
