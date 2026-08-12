import Panzoom, { type PanzoomObject } from '@panzoom/panzoom';
import { useEffect, useRef, useState } from 'react';
import {
  downloadSessionAttachment,
  getSessionAttachmentFile,
} from '../../../../../../../common/features/programming/api/programming.api';
import Button from '../../../../../../../common/components/Button/Button';
import Modal from '../../../../../../../common/components/Modal/Modal';
import type { CohortSession, SessionAttachment } from '../../../../../../../common/types/cohort';
import './SessionAttachmentViewerModal.css';

export default function SessionAttachmentViewerModal({
  session,
  attachment,
  onClose,
}: {
  session: CohortSession | null;
  attachment: SessionAttachment | null;
  onClose: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const panzoomRef = useRef<PanzoomObject | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const canPreview = attachment?.mimeType.startsWith('image/')
    || attachment?.mimeType === 'application/pdf'
    || attachment?.mimeType === 'text/plain';

  useEffect(() => {
    if (!session || !attachment || !canPreview) {
      setPreviewUrl(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return undefined;
    }
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewError(null);
    void getSessionAttachmentFile(session.id, attachment.id, { signal: controller.signal })
      .then(blob => {
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setPreviewError(cause instanceof Error ? cause.message : 'Could not load attachment preview');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPreviewLoading(false);
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment, canPreview, session]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = image?.parentElement;
    if (!image || !canvas || !previewUrl || !attachment?.mimeType.startsWith('image/')) return undefined;

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
  }, [attachment?.mimeType, previewLoading, previewUrl]);

  return (
    <Modal
      isOpen={attachment !== null && session !== null}
      onClose={onClose}
      title={attachment?.title ?? ''}
      maxWidth="900px"
      footer={attachment && session ? <div className="session-attachment-viewer__footer">
        {attachment.mimeType.startsWith('image/') && <div role="toolbar" aria-label="Image zoom controls">
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
        <div className="session-attachment-viewer__footer-actions">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button onClick={() => void downloadSessionAttachment(session.id, attachment)}>Download</Button>
        </div>
      </div> : undefined}
    >
      {attachment && <div className="session-attachment-viewer">
        <div className="session-attachment-viewer__preview">
          {previewLoading ? <p role="status">Loading preview…</p> : previewError ? (
            <p role="alert">{previewError}</p>
          ) : previewUrl && attachment.mimeType.startsWith('image/') ? (
            <img ref={imageRef} src={previewUrl} alt={attachment.title} />
          ) : previewUrl ? (
            <iframe src={previewUrl} title={`${attachment.title} preview`} />
          ) : (
            <p>This file type cannot be previewed here. Download it to open it.</p>
          )}
        </div>
      </div>}
    </Modal>
  );
}
