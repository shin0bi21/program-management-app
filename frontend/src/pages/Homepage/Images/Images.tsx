import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';

import HomepageImageList from './components/HomepageImageList/HomepageImageList';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { useHomepageModals } from './hooks/useHomepageModals';
import { useManagedHomepage } from './hooks/useManagedHomepage';

import './Images.css';

/**
 * Displays homepage image management and connects permission-gated editing to saved records.
 * @example <Images /> // managed image list and image/delete dialogs
 */
export default function Images() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:homepage');

  const homepage = useManagedHomepage();

  const modals = useHomepageModals({ deleteImage: homepage.deleteImage });

  return (
    <>
      <PageContainer
        title="Images"
        className="homepage-management-page"
        ariaLabel="Homepage image management"
        actions={canWrite && <Button disabled={homepage.reordering} onClick={modals.image.openNew}>+ Add</Button>}
        messages={[homepage.error ? {
          message: homepage.error,
          action: { label: 'Retry', onClick: homepage.refresh },
        } : null]}
        table={<HomepageImageList
          images={homepage.images}
          loading={homepage.loading}
          error={homepage.error}
          onRetry={homepage.refresh}
          onEdit={modals.image.openEdit}
          onDelete={modals.deletion.open}
          onReorder={homepage.reorderImages}
          canWrite={canWrite}
          mutationsPending={homepage.reordering}
        />}
      />

      {canWrite && <HomepageImageModal
        image={modals.image.target}
        isOpen={modals.image.open}
        onClose={modals.image.close}
        onSaved={homepage.saveImage}
      />}

      {canWrite && <ConfirmModal
        action={modals.deletion.action}
        onClose={modals.deletion.close}
      />}
    </>
  );
}
