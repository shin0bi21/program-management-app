import Button from '../Button/Button';
import type { SubmitStatus } from '../../hooks/useSubmitStatus';

interface ModalFormFooterProps {
  formId: string;
  submitLabel: string;
  submitStatus: SubmitStatus;
  onClose: () => void;
}

export default function ModalFormFooter({ formId, submitLabel, submitStatus, onClose }: ModalFormFooterProps) {
  const disabled = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <>
      <Button type="button" variant="secondary" onClick={onClose} disabled={disabled}>
        Cancel
      </Button>
      <Button type="submit" form={formId} disabled={disabled}>
        {submitLabel}
      </Button>
    </>
  );
}
