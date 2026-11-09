import Button from '../../components/Button/Button';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner';
import Modal from '../../components/Modal/Modal';
import useFilePreview from './hooks/useFilePreview';
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

/**
 * Mounts file preview controls and resources only while the viewer is open.
 * @param props - Visibility, supplied file, loading state, and viewer callbacks.
 * @example <ViewFileModal isOpen={isOpen} file={file} mimeType="application/pdf" title="Report" onClose={close} />
 */
export default function ViewFileModal({ isOpen, ...props }: ViewFileModalProps) {
  return isOpen ? <FilePreview {...props} /> : null;
}

/**
 * Owns preview URLs and image zoom for one mounted viewer interaction.
 * @param props - Supplied file and the display/download controls for it.
 * @example <FilePreview file={file} mimeType="application/pdf" title="Report" onClose={close} />
 */
function FilePreview({
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
}: Omit<ViewFileModalProps, 'isOpen'>) {
  const preview = useFilePreview(file, mimeType);
  const { imageRef, previewUrl, isImage, canPreview } = preview;

  const downloadAction = previewUrl && downloadName ? (
    <a className="btn view-file-modal__download" href={previewUrl} download={downloadName}>{downloadLabel}</a>
  ) : onDownload ? (
    <Button onClick={() => void onDownload()}>{downloadLabel}</Button>
  ) : null;

  return <Modal
    isOpen
    onClose={onClose}
    title={title}
    maxWidth={maxWidth}
    footer={<div className="view-file-modal__footer">
      {isImage && previewUrl && <div role="toolbar" aria-label="Image zoom controls">
        <Button size="sm" variant="secondary" onClick={preview.zoomOut}>
          Zoom out
        </Button>
        <Button size="sm" variant="secondary" onClick={preview.resetZoom}>
          Reset
        </Button>
        <Button size="sm" variant="secondary" onClick={preview.zoomIn}>
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
