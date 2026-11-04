import { useState } from 'react';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

import type { ManagedHomepageImage } from '../../types';

import './HomepageImageList.css';

interface HomepageImageListProps {
  images: ManagedHomepageImage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (image: ManagedHomepageImage) => void;
  onDelete: (image: ManagedHomepageImage) => void;
  onReorder: (sourceImageId: string, targetImageId: string) => void | Promise<void>;
  canWrite: boolean;
  mutationsPending: boolean;
}

export default function HomepageImageList({
  images,
  loading,
  error,
  onRetry,
  onEdit,
  onDelete,
  onReorder,
  canWrite,
  mutationsPending,
}: HomepageImageListProps) {
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);

  const clearDragState = () => {
    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  return (
    <div className="homepage-image-list" role="list" aria-label="Homepage hero images">
      {loading ? (
        <p className="homepage-management-empty">Loading images…</p>
      ) : error ? (
        <UnavailableState title="Homepage images unavailable" onRetry={onRetry} />
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
              draggable={canWrite && !mutationsPending}
              onDragStart={(event) => {
                if (!canWrite || mutationsPending) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', image.id);
                setDraggedImageId(image.id);
              }}
              onDragEnter={() => {
                if (canWrite && !mutationsPending) setDragOverImageId(image.id);
              }}
              onDragOver={(event) => {
                if (!canWrite || mutationsPending) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                if (!canWrite || mutationsPending) return;
                event.preventDefault();
                const sourceImageId = event.dataTransfer.getData('text/plain') || draggedImageId;
                if (sourceImageId) void onReorder(sourceImageId, image.id);
                clearDragState();
              }}
              onDragEnd={clearDragState}
            >
              <span className="homepage-image-row__drag-handle" aria-hidden="true">
                <FontAwesomeIcon icon={faGripVertical} />
              </span>
              <img
                className="homepage-image-row__thumbnail"
                src={image.thumbnailUrl}
                alt=""
                draggable={false}
              />
              <span className="homepage-image-row__caption" title={image.caption}>
                {image.caption}
              </span>
              {canWrite && <ActionsMenu
                ariaLabel={`More actions for ${image.caption}`}
                disabled={mutationsPending}
                items={[
                  { id: 'edit', label: 'Edit Image', onClick: () => onEdit(image) },
                  {
                    id: 'delete',
                    label: 'Delete Image',
                    variant: 'danger',
                    onClick: () => onDelete(image),
                  },
                ]}
              />}
            </div>
          ))}
        </>
      ) : (
        <p className="homepage-management-empty">No homepage images</p>
      )}
    </div>
  );
}
