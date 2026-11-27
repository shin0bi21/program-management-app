import { useState } from 'react';
import { useForm } from 'react-hook-form';

import type { SubmitStatus } from '../../../../../../common/hooks/useSubmitStatus';
import useSubmitLock from '../../../../../../common/hooks/useSubmitLock';
import { getErrorMessage } from '../../../../../../http/errors';
import { createHomepageImage, updateHomepageImage } from '../../../manageHomepage.api';
import type { ManagedHomepageImage } from '../../../types';

interface UseHomepageImageModalOptions {
  image: ManagedHomepageImage | null;
  onSaved: (image: ManagedHomepageImage) => Promise<void>;
}

/**
 * Saves an image upload or caption and waits for the owner to reconcile the returned record.
 * @param options - Saved edit snapshot and authoritative save callback for the mounted form.
 * @example useHomepageImageModal({ image, onSaved }) // caption-edit workflow
 */
export default function useHomepageImageModal({
  image,
  onSaved,
}: UseHomepageImageModalOptions) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const { register, setValue, handleSubmit } = useForm<{ image?: FileList; caption: string }>({
    defaultValues: { caption: image?.caption ?? '' },
  });
  const { tryLock, unlock } = useSubmitLock();

  /**
   * Saves the caption and optional upload once, forwarding the server's complete image.
   * @example await submit() // saves and reconciles before reporting success
   */
  const submit = handleSubmit(async draft => {
    if (!tryLock()) return;

    setStatus('submitting');
    setStatusMessage(image ? 'Saving homepage image...' : 'Uploading homepage image...');

    const caption = draft.caption.trim();
    const selectedFile = draft.image?.[0];
    let savedImage: ManagedHomepageImage;
    try {
      if (image) {
        savedImage = await updateHomepageImage(image.id, { caption });
      } else {
        if (!selectedFile?.size) throw new Error('Choose an image to upload');
        savedImage = await createHomepageImage({ image: selectedFile, caption });
      }
    } catch (cause) {
      setStatus('error');
      setStatusMessage(getErrorMessage(cause, 'Could not save homepage image'));
      unlock();
      return;
    }

    let message = image ? 'Homepage image updated.' : 'Homepage image added.';
    try {
      await onSaved(savedImage);
    } catch {
      message = 'Homepage image was saved, but the page could not refresh. Reload to see it.';
    }
    setStatus('success');
    setStatusMessage(message);
  });

  return {
    status,
    statusMessage,
    submissionComplete: status === 'submitting' || status === 'success',
    register,
    setValue,
    submit,
  };
}
