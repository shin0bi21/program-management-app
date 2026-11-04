import { useAuth } from '../../../auth/authContext';
import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageMessageOverlay from '../../../common/components/PageMessageOverlay/PageMessageOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';

import HomepageImageList from './components/HomepageImageList/HomepageImageList';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { useHomepageModals } from './hooks/useHomepageModals';
import { useManagedHomepage } from './hooks/useManagedHomepage';

import '../common/homepageManagement.css';

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
      <main className="page-container homepage-management-page">
        <PageHeader
          title="Images"
          actions={canWrite && <Button disabled={homepage.reordering} onClick={modals.image.openNew}>+ Add</Button>}
        />
        <PageMessageOverlay messages={[homepage.error ? {
          message: homepage.error,
          action: { label: 'Retry', onClick: homepage.refresh },
        } : null]} />
        <PageBody
          ariaLabel="Homepage image management"
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
      </main>

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
