import Button from '../Button/Button';
import type { SubmitStatus } from '../../hooks/useSubmitStatus';

interface ModalFormFooterProps {
  formId: string;
  submitLabel: string;
  submitStatus: SubmitStatus;
  submitDisabled?: boolean;
  onClose: () => void;
}

export default function ModalFormFooter({
  formId,
  submitLabel,
  submitStatus,
  submitDisabled = false,
  onClose,
}: ModalFormFooterProps) {
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <>
      <Button type="button" variant="secondary" onClick={onClose} disabled={submissionComplete}>
        Cancel
      </Button>
      <Button type="submit" form={formId} disabled={submissionComplete || submitDisabled}>
        {submitLabel}
      </Button>
    </>
  );
}
