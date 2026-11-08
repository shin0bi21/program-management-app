import type { FormEvent } from 'react';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import ModalFormFooter from '../../../../../common/components/Modal/components/ModalFormFooter';
import type { ManagedHomepageImage } from '../../types';
import useHomepageImageModal from './hooks/useHomepageImageModal';

interface HomepageImageModalProps {
  image: ManagedHomepageImage | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (image: ManagedHomepageImage) => Promise<void>;
}

/**
 * Edits a supplied image caption or uploads a new image, then forwards the saved record.
 * @param props - Saved edit snapshot, dialog visibility, and close/reconciliation callbacks.
 * @example <HomepageImageModal image={image} isOpen onClose={close} onSaved={saveImage} />
 */
export default function HomepageImageModal({ image, isOpen, onClose, onSaved }: HomepageImageModalProps) {
  const workflow = useHomepageImageModal({ image, isOpen, onSaved });

  /**
   * Reads and trims the caption before submitting through the image workflow.
   * @param event - Native form submission containing the caption draft.
   * @example submit(event) // sends the trimmed caption without changing the saved image snapshot
   */
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const caption = String(form.get('caption')).trim();
    await workflow.submit(caption);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manage Images"
      status={workflow.status}
      statusMessage={workflow.statusMessage}
      footer={(
        <ModalFormFooter
          formId="homepage-image-form"
          submitStatus={workflow.status}
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
              disabled={workflow.submissionComplete}
              onChange={(event) => workflow.setSelectedFile(event.currentTarget.files?.[0] ?? null)}
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
            disabled={workflow.submissionComplete}
          />
        </FormField>
      </form>
    </Modal>
  );
}
