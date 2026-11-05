import { useAuth } from '../../../auth/authContext';
import PageContainer from '../../../common/components/PageContainer/PageContainer';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';

import HomepageImageList from './components/HomepageImageList/HomepageImageList';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { useHomepageModals } from './hooks/useHomepageModals';
import { useManagedHomepage } from './hooks/useManagedHomepage';

import './Images.css';

export default function Images() {
  const { permissions } = useAuth();
  const canWrite = permissions.includes('write:homepage');

  // Data and actions.
  const homepage = useManagedHomepage();

  // Modal workflows.
  const modals = useHomepageModals({ deleteImage: homepage.deleteImage });

  // Render.
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
        onSaved={homepage.refresh}
      />}

      {canWrite && <ConfirmModal
        action={modals.deletion.action}
        onClose={modals.deletion.close}
      />}
    </>
  );
}
