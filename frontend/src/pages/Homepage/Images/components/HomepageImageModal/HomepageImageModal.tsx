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
 * Mounts a supplied caption editor or empty upload form while the dialog is open.
 * @param props - Saved edit snapshot, dialog visibility, and close/reconciliation callbacks.
 * @example <HomepageImageModal image={image} isOpen onClose={close} onSaved={saveImage} />
 */
export default function HomepageImageModal({ isOpen, ...props }: HomepageImageModalProps) {
  return isOpen ? <ImageForm key={props.image?.id ?? 'new'} {...props} /> : null;
}

/**
 * Owns one supplied caption or empty upload until close or completed save feedback.
 * @param props - Saved image, if editing, and close/reconciliation callbacks.
 * @example <ImageForm image={image} onClose={close} onSaved={saveImage} />
 */
function ImageForm({ image, onClose, onSaved }: Omit<HomepageImageModalProps, 'isOpen'>) {
  const workflow = useHomepageImageModal({ image, onSaved });


  return (
    <Modal
      isOpen
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
      <form id="homepage-image-form" onSubmit={workflow.submit}>
        {!image && (
          <FormField id="homepage-image-file" label="Image">
            <input
              id="homepage-image-file"
              {...workflow.register('image')}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={workflow.submissionComplete}
              required
            />
          </FormField>
        )}
        <FormField id="homepage-image-caption" label="Caption">
          <textarea
            id="homepage-image-caption"
            {...workflow.register('caption')}
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
