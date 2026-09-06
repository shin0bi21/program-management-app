import Panzoom, { type PanzoomObject } from '@panzoom/panzoom';
import { useEffect, useRef, useState } from 'react';

export default function useFilePreview(file: Blob | null, mimeType: string) {
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

  return {
    imageRef,
    previewUrl,
    isImage,
    canPreview,
    zoomOut: () => panzoomRef.current?.zoomOut({ animate: true }),
    resetZoom: () => panzoomRef.current?.reset({ animate: true }),
    zoomIn: () => panzoomRef.current?.zoomIn({ animate: true }),
  };
}
