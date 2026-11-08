import { useEffect, useState } from 'react';

import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import { createHomepageImage, updateHomepageImage } from '../../../manageHomepage.api';
import type { ManagedHomepageImage } from '../../../types';

interface UseHomepageImageModalOptions {
  image: ManagedHomepageImage | null;
  isOpen: boolean;
  onSaved: (image: ManagedHomepageImage) => Promise<void>;
}

/**
 * Saves an image upload or caption and waits for the owner to reconcile the returned record.
 * @param options - Saved edit snapshot, open state, and authoritative save callback.
 * @example useHomepageImageModal({ image, isOpen, onSaved }) // caption-edit workflow
 */
export default function useHomepageImageModal({
  image,
  isOpen,
  onSaved,
}: UseHomepageImageModalOptions) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { tryLock, unlock } = useSubmitLock();

  useEffect(() => {
    if (!isOpen) return;

    setStatus('idle');
    setStatusMessage('');
    setSelectedFile(null);
    unlock();
  }, [image, isOpen, unlock]);

  /**
   * Saves the caption and optional upload once, forwarding the server's complete image.
   * @param caption - Trimmed caption supplied by the rendered form.
   * @example await submit('Community event.') // saves and reconciles before reporting success
   */
  const submit = async (caption: string) => {
    if (!tryLock()) return;

    setStatus('submitting');
    setStatusMessage(image ? 'Saving homepage image...' : 'Uploading homepage image...');

    try {
      let savedImage: ManagedHomepageImage;
      if (image) {
        savedImage = await updateHomepageImage(image.id, { caption });
      } else {
        if (!selectedFile?.size) throw new Error('Choose an image to upload');
        savedImage = await createHomepageImage({ image: selectedFile, caption });
      }

      await onSaved(savedImage);
      setStatus('success');
      setStatusMessage(image ? 'Homepage image updated.' : 'Homepage image added.');
    } catch (cause) {
      setStatus('error');
      setStatusMessage(getErrorMessage(cause, 'Could not save homepage image'));
      unlock();
    }
  };

  return {
    status,
    statusMessage,
    submissionComplete: status === 'submitting' || status === 'success',
    setSelectedFile,
    submit,
  };
}
