import Button from '../../Button/Button';
import type { SubmitStatus } from '../../../hooks/useSubmitStatus';

interface ModalFormFooterProps {
  formId: string;
  submitStatus: SubmitStatus;
  submitDisabled?: boolean;
  onClose: () => void;
}

/**
 * Displays Cancel and Save for a modal form, disabling both during submission and success feedback.
 * @param props.formId - ID of an existing form to submit, including from outside that form.
 * @param props.submitDisabled - Blocks only Save, for example while required form data is loading.
 * @param props.onClose - Requests closing on Cancel; the caller owns dismissal.
 * @example <ModalFormFooter formId="task-form" submitStatus="idle" onClose={closeTaskModal} />
 */
export default function ModalFormFooter({
  formId,
  submitStatus,
  submitDisabled = false,
  onClose,
}: ModalFormFooterProps) {
  const actionsDisabled = submitStatus === 'submitting' || submitStatus === 'success';

  return (
    <>
      <Button type="button" variant="secondary" onClick={onClose} disabled={actionsDisabled}>
        Cancel
      </Button>
      <Button type="submit" form={formId} disabled={actionsDisabled || submitDisabled}>
        Save
      </Button>
    </>
  );
}
