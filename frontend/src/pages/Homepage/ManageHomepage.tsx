import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import ActionsMenu from '../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../common/components/Button/Button';
import Header from '../../common/components/Header/Header';
import Modal from '../../common/components/Modal/Modal';
import PageHeader from '../../common/components/PageHeader/PageHeader';
import { useConfirmModal, type ConfirmAction } from '../../common/components/Modal/hooks/useConfirmModal';
import { getErrorMessage } from '../../common/utils/clientErrors';
import {
  deleteHomepageImage,
  getManagedHomepage,
  getPublicHomepage,
  reorderHomepageImages,
  type HomepageContent,
  type HomepageImage,
} from './api/homepage.api';
import HomepageImageModal from './components/HomepageImageModal/HomepageImageModal';
import { HomepageContent as HomepagePreviewContent } from './Homepage';
import './ManageHomepage.css';

export default function ManageHomepage() {
  const queryClient = useQueryClient();
  const managedQuery = useQuery({
    queryKey: ['homepage', 'managed'],
    queryFn: ({ signal }) => getManagedHomepage({ signal }),
  });
  const images = managedQuery.data?.images ?? [];
  const loading = managedQuery.isLoading;
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (managedQuery.error
    ? getErrorMessage(managedQuery.error, 'Could not load homepage management')
    : null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<HomepageContent>({ images: [], sessions: [] });
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageTarget, setImageTarget] = useState<HomepageImage | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const confirmModal = useConfirmModal({
    action: confirmAction,
    onClose: () => setConfirmAction(null),
  });

  const load = async () => {
    setActionError(null);
    await managedQuery.refetch();
  };

  const openAddImage = () => {
    setImageTarget(null);
    setImageModalOpen(true);
  };

  const openPreview = async () => {
    setActionError(null);
    try {
      setPreviewContent(await queryClient.fetchQuery({
        queryKey: ['homepage', 'public'],
        queryFn: ({ signal }) => getPublicHomepage({ signal }),
      }));
      setPreviewOpen(true);
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not load homepage preview'));
    }
  };

  const imageActions = (image: HomepageImage) => [
    {
      id: 'edit',
      label: 'Edit Image',
      onClick: () => {
        setImageTarget(image);
        setImageModalOpen(true);
      },
    },
    {
      id: 'delete',
      label: 'Delete Image',
      variant: 'danger' as const,
      onClick: () =>
        setConfirmAction({
          title: 'Delete Homepage Image',
          message: `Delete “${image.caption}”? This cannot be undone.`,
          confirmLabel: 'Delete',
          confirmVariant: 'danger',
          successMessage: 'Homepage image deleted',
          onConfirm: async () => {
            await deleteHomepageImage(image.id);
            await load();
          },
        }),
    },
  ];

  const dropImage = async (targetImageId: string, sourceImageId = draggedImageId) => {
    if (!sourceImageId || sourceImageId === targetImageId) {
      setDraggedImageId(null);
      setDragOverImageId(null);
      return;
    }

    const reordered = [...images];
    const fromIndex = reordered.findIndex((image) => image.id === sourceImageId);
    const targetIndex = reordered.findIndex((image) => image.id === targetImageId);
    if (fromIndex < 0 || targetIndex < 0) return;
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const orderedImages = reordered.map((image, displayOrder) => ({ ...image, displayOrder }));
    queryClient.setQueryData(['homepage', 'managed'], { images: orderedImages });
    setActionError(null);
    setDraggedImageId(null);
    setDragOverImageId(null);

    try {
      await reorderHomepageImages(orderedImages.map((image) => image.id));
    } catch (cause) {
      setActionError(getErrorMessage(cause, 'Could not save image order'));
      await load();
    }
  };

  const previewPhotos = previewContent.images.map((image) => ({
    src: image.imageUrl,
    alt: image.altText,
    caption: image.caption,
  }));
  return (
    <>
      <Header />
      <div className="page-container homepage-management-page">
        <PageHeader
          title="Manage Homepage"
          actions={
            <div className="homepage-management-header-actions">
              <Button variant="secondary" onClick={() => void openPreview()}>
                Preview
              </Button>
            </div>
          }
        />

        <div className="homepage-management-content">
          <section
            className="homepage-management-section homepage-management-images"
            aria-labelledby="homepage-images-title"
          >
            <div className="homepage-management-section-heading">
              <div>
                <h2 id="homepage-images-title">Manage Images</h2>
              </div>
              <Button size="sm" onClick={openAddImage}>
                + Add
              </Button>
            </div>
            <div className="homepage-image-list" role="list" aria-label="Homepage hero images">
              {loading ? (
                <p className="homepage-management-empty">Loading images…</p>
              ) : error ? (
                <p className="homepage-management-error">{error}</p>
              ) : images.length ? (
                <>
                  <div className="homepage-image-list__header" aria-hidden="true">
                    <span />
                    <span>Image</span>
                    <span>Caption</span>
                    <span />
                  </div>
                  {images.map((image) => (
                    <div
                      key={image.id}
                      role="listitem"
                      className={`homepage-image-row${
                        draggedImageId === image.id ? ' homepage-image-row--dragging' : ''
                      }${dragOverImageId === image.id ? ' homepage-image-row--drag-over' : ''}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', image.id);
                        setDraggedImageId(image.id);
                      }}
                      onDragEnter={() => setDragOverImageId(image.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        void dropImage(image.id, event.dataTransfer.getData('text/plain') || draggedImageId);
                      }}
                      onDragEnd={() => {
                        setDraggedImageId(null);
                        setDragOverImageId(null);
                      }}
                    >
                      <span className="homepage-image-row__drag-handle" aria-hidden="true">
                        <FontAwesomeIcon icon={faGripVertical} />
                      </span>
                      <img className="homepage-image-row__thumbnail" src={image.thumbnailUrl} alt="" draggable={false} />
                      <span className="homepage-image-row__caption" title={image.caption}>
                        {image.caption}
                      </span>
                      <ActionsMenu ariaLabel={`More actions for ${image.caption}`} items={imageActions(image)} />
                    </div>
                  ))}
                </>
              ) : (
                <p className="homepage-management-empty">No homepage images</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <HomepageImageModal
        image={imageTarget}
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onSaved={load}
      />

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Homepage Preview"
        maxWidth="calc(100vw - 2rem)"
      >
        <div className="homepage-preview-shell">
          <HomepagePreviewContent photos={previewPhotos} sessions={previewContent.sessions} />
        </div>
      </Modal>

      <Modal
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        status={confirmModal.status}
        statusMessage={confirmModal.statusMessage}
        footer={confirmModal.footer}
        disableClose={confirmModal.disableClose}
        successDelay={confirmModal.successDelay}
      >
        {confirmAction && <p>{confirmAction.message}</p>}
      </Modal>
    </>
  );
}
