import Button from '../../../common/components/Button/Button';
import ConfirmModal from '../../../common/components/ConfirmModal/ConfirmModal';
import PageBody from '../../../common/components/PageBody/PageBody';
import PageErrorOverlay from '../../../common/components/PageErrorOverlay/PageErrorOverlay';
import PageHeader from '../../../common/components/PageHeader/PageHeader';

import HomepageSignupSetting from './components/HomepageSignupSetting/HomepageSignupSetting';
import HomepageImageList from './components/HomepageImageList/HomepageImageList';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { useHomepageModals } from './hooks/useHomepageModals';
import { useManagedHomepage } from './hooks/useManagedHomepage';

import './ManageHomepage.css';

export default function ManageHomepage() {
  // Data and actions.
  const homepage = useManagedHomepage();

  // Modal workflows.
  const modals = useHomepageModals({ deleteImage: homepage.deleteImage });

  // Render.
  return (
    <>
      <main className="page-container homepage-management-page">
        <PageHeader
          title="Manage Homepage"
          actions={<Button size="sm" onClick={modals.image.openNew}>+ Add</Button>}
        />
        <PageErrorOverlay errors={[homepage.error ? {
          message: homepage.error,
          action: { label: 'Retry', onClick: homepage.refresh },
        } : null]} />
        <PageBody
          ariaLabel="Homepage image management"
          dashboard={<HomepageSignupSetting />}
          table={<HomepageImageList
            images={homepage.images}
            loading={homepage.loading}
            error={homepage.error}
            onRetry={homepage.refresh}
            onEdit={modals.image.openEdit}
            onDelete={modals.deletion.open}
            onReorder={homepage.reorderImages}
          />}
        />
      </main>

      <HomepageImageModal
        image={modals.image.target}
        isOpen={modals.image.open}
        onClose={modals.image.close}
        onSaved={homepage.refresh}
      />

      <ConfirmModal
        action={modals.deletion.action}
        onClose={modals.deletion.close}
      />
    </>
  );
}
