import { useEffect, useRef, useState } from 'react';
import type { ViewFileModalProps } from '../ViewFileModal';

interface UseViewFileModalOptions extends Omit<
  ViewFileModalProps,
  'file' | 'loading' | 'error' | 'isOpen'
> {
  requestKey: string;
  loadFile: (signal: AbortSignal) => Promise<Blob>;
  formatLoadError: (cause: unknown) => string;
}

interface LoadedFile {
  requestKey: string;
  file: Blob;
}

/**
 * Loads preview content for a mounted viewer, cancelling unfinished loads on departure.
 * @param options - File identity, presentation props, cancellable loader and error formatter.
 * @example useViewFileModal({ requestKey: reportId, loadFile, formatLoadError, ...viewerProps })
 */
export default function useViewFileModal({
  requestKey,
  loadFile,
  formatLoadError,
  ...modalProps
}: UseViewFileModalOptions): ViewFileModalProps {
  const loadFileRef = useRef(loadFile);
  const formatLoadErrorRef = useRef(formatLoadError);
  const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canPreview = modalProps.mimeType.startsWith('image/')
    || modalProps.mimeType === 'application/pdf'
    || modalProps.mimeType === 'text/plain';

  loadFileRef.current = loadFile;
  formatLoadErrorRef.current = formatLoadError;

  useEffect(() => {
    if (!canPreview) {
      setLoadedFile(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    setLoadedFile(null);
    setLoading(true);
    setError(null);
    void loadFileRef.current(controller.signal)
      .then(loadedFile => {
        if (!controller.signal.aborted) {
          setLoadedFile({ requestKey, file: loadedFile });
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(formatLoadErrorRef.current(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [canPreview, requestKey]);

  return {
    ...modalProps,
    isOpen: true,
    file: loadedFile?.requestKey === requestKey ? loadedFile.file : null,
    loading,
    error,
  };
}
