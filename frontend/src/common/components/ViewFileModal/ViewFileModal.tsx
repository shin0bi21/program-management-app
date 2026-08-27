import Panzoom, { type PanzoomObject } from '@panzoom/panzoom';
import { useEffect, useRef, useState } from 'react';
import Button from '../Button/Button';
import LoadingSpinner from '../LoadingSpinner/LoadingSpinner';
import Modal from '../Modal/Modal';
import './ViewFileModal.css';

export interface ViewFileModalProps {
  isOpen: boolean;
  title: string;
  file: Blob | null;
  mimeType: string;
  loading?: boolean;
  error?: string | null;
  downloadName?: string;
  downloadLabel?: string;
  onDownload?: () => void | Promise<void>;
  onClose: () => void;
  maxWidth?: string;
}

export default function ViewFileModal({
  isOpen,
  title,
  file,
  mimeType,
  loading = false,
  error = null,
  downloadName,
  downloadLabel = 'Download',
  onDownload,
  onClose,
  maxWidth = '900px',
}: ViewFileModalProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = mimeType.startsWith('image/');
  const canPreview = isImage || mimeType === 'application/pdf' || mimeType === 'text/plain';

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = image?.parentElement;
    if (!image || !canvas || !previewUrl || !isImage) return undefined;

    const panzoom = Panzoom(image, {
      contain: 'outside',
      maxScale: 6,
      minScale: 1,
      panOnlyWhenZoomed: true,
      step: 0.35,
    });
    const zoomWithWheel = (event: WheelEvent) => panzoom.zoomWithWheel(event);
    canvas.addEventListener('wheel', zoomWithWheel, { passive: false });
    panzoomRef.current = panzoom;

    return () => {
      canvas.removeEventListener('wheel', zoomWithWheel);
      panzoom.destroy();
      panzoomRef.current = null;
    };
  }, [isImage, previewUrl]);

  const downloadAction = previewUrl && downloadName ? (
    <a className="btn view-file-modal__download" href={previewUrl} download={downloadName}>{downloadLabel}</a>
  ) : onDownload ? (
    <Button onClick={() => void onDownload()}>{downloadLabel}</Button>
  ) : null;

  return <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    maxWidth={maxWidth}
    footer={<div className="view-file-modal__footer">
      {isImage && previewUrl && <div role="toolbar" aria-label="Image zoom controls">
        <Button size="sm" variant="secondary" onClick={() => panzoomRef.current?.zoomOut({ animate: true })}>
          Zoom out
        </Button>
        <Button size="sm" variant="secondary" onClick={() => panzoomRef.current?.reset({ animate: true })}>
          Reset
        </Button>
        <Button size="sm" variant="secondary" onClick={() => panzoomRef.current?.zoomIn({ animate: true })}>
          Zoom in
        </Button>
      </div>}
      <div className="view-file-modal__actions">
        <Button variant="secondary" onClick={onClose}>Close</Button>
        {downloadAction}
      </div>
    </div>}
  >
    <div className="view-file-modal__preview">
      {loading ? <div className="view-file-modal__loading" role="status">
        <LoadingSpinner />
        <span>Loading preview…</span>
      </div> : error ? (
        <p className="form-error" role="alert">{error}</p>
      ) : previewUrl && isImage ? (
        <img ref={imageRef} src={previewUrl} alt={title} />
      ) : previewUrl && canPreview ? (
        <iframe src={previewUrl} title={`${title} preview`} />
      ) : !canPreview ? (
        <p>This file type cannot be previewed here. Download it to open it.</p>
      ) : null}
    </div>
  </Modal>;
}
