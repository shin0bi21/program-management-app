import { type FormEvent, useEffect, useState } from 'react';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';
import { getErrorMessage } from '../../../../../http/clientErrors';
import { createHomepageImage, updateHomepageImage } from '../../manageHomepage.api';
import type { ManagedHomepageImage } from '../../types';

interface HomepageImageModalProps {
  image: ManagedHomepageImage | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export default function HomepageImageModal({ image, isOpen, onClose, onSaved }: HomepageImageModalProps) {
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setStatusMessage('');
    setSelectedFile(null);
  }, [image, isOpen]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caption = String(form.get('caption')).trim();
    setStatus('submitting');
    setStatusMessage(image ? 'Saving homepage image...' : 'Uploading homepage image...');

    try {
      if (image) {
        await updateHomepageImage(image.id, { caption });
      } else {
        if (!selectedFile?.size) {
          throw new Error('Choose an image to upload');
        }
        await createHomepageImage({
          image: selectedFile,
          caption,
        });
      }
      await onSaved();
      setStatus('success');
      setStatusMessage(image ? 'Homepage image updated.' : 'Homepage image added.');
    } catch (cause) {
      setStatus('error');
      setStatusMessage(getErrorMessage(cause, 'Could not save homepage image'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Images"
      status={status}
      statusMessage={statusMessage}
      successDelay={1200}
      footer={(
        <ModalFormFooter
          formId="homepage-image-form"
          submitLabel={image ? 'Save' : 'Add Image'}
          submitStatus={status}
          onClose={onClose}
        />
      )}
    >
      <form id="homepage-image-form" onSubmit={(event) => void submit(event)}>
        {!image && (
          <FormField id="homepage-image-file" label="Image">
            <input
              id="homepage-image-file"
              name="image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setSelectedFile(event.currentTarget.files?.[0] ?? null)}
              required
            />
          </FormField>
        )}
        <FormField id="homepage-image-caption" label="Caption">
          <textarea
            id="homepage-image-caption"
            name="caption"
            defaultValue={image?.caption ?? ''}
            rows={3}
            maxLength={500}
            required
          />
        </FormField>
      </form>
    </Modal>
  );
}
