import { useState } from 'react';
import { faGripVertical } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import ActionsMenu from '../../../../../common/components/ActionsMenu/ActionsMenu';
import Button from '../../../../../common/components/Button/Button';
import UnavailableState from '../../../../../common/components/UnavailableState/UnavailableState';

import type { ManagedHomepageImage } from '../../types';

import './HomepageImageList.css';

interface HomepageImageListProps {
  images: ManagedHomepageImage[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onAdd: () => void;
  onEdit: (image: ManagedHomepageImage) => void;
  onDelete: (image: ManagedHomepageImage) => void;
  onReorder: (sourceImageId: string, targetImageId: string) => void | Promise<void>;
}

export default function HomepageImageList({
  images,
  loading,
  error,
  onRetry,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
}: HomepageImageListProps) {
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);

  const clearDragState = () => {
    setDraggedImageId(null);
    setDragOverImageId(null);
  };

  return (
    <section
      className="homepage-management-card homepage-management-section homepage-management-images"
      aria-labelledby="homepage-images-title"
    >
      <div className="homepage-management-section__header">
        <h2 id="homepage-images-title">Manage Images</h2>
        <Button size="sm" onClick={onAdd}>+ Add</Button>
      </div>
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
                <ActionsMenu
                  ariaLabel={`More actions for ${image.caption}`}
                  items={[
                    { id: 'edit', label: 'Edit Image', onClick: () => onEdit(image) },
                    {
                      id: 'delete',
                      label: 'Delete Image',
                      variant: 'danger',
                      onClick: () => onDelete(image),
                    },
                  ]}
                />
              </div>
            ))}
          </>
        ) : (
          <p className="homepage-management-empty">No homepage images</p>
        )}
      </div>
    </section>
  );
}
