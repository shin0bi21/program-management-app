import type { FormEvent, ReactNode } from 'react';
import FloatingSelect from '../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../components/FormField/FormField';
import Modal from '../../../components/Modal/Modal';
import ModalFormFooter from '../../../components/Modal/components/ModalFormFooter';
import type { SubmitStatus } from '../../../hooks/useSubmitStatus';

interface NoteModalProps {
  isOpen: boolean;
  title: string;
  formId: string;
  categoryLabel: string;
  category: string;
  categoryOptions: Array<{ value: string; label: string }>;
  categoryDisabled?: boolean;
  details: string;
  submitStatus: SubmitStatus;
  statusMessage?: string;
  maxLength?: number;
  children?: ReactNode;
  onCategoryChange: (category: string) => void;
  onDetailsChange: (details: string) => void;
  onSubmit: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * Displays a caller-owned note draft with shared submission feedback.
 * The caller's mounted form owns initialization and the draft's lifetime.
 * @param props - Visibility, controlled fields, submission state, and form callbacks.
 * @example <NoteModal isOpen={isOpen} {...noteFields} onClose={close} />
 */
export default function NoteModal({
  isOpen,
  title,
  formId,
  categoryLabel,
  category,
  categoryOptions,
  categoryDisabled = false,
  details,
  submitStatus,
  statusMessage,
  maxLength = 5000,
  children,
  onCategoryChange,
  onDetailsChange,
  onSubmit,
  onClose,
}: NoteModalProps) {
  const submissionComplete = submitStatus === 'submitting' || submitStatus === 'success';
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      status={submitStatus}
      statusMessage={statusMessage}
      footer={<ModalFormFooter formId={formId} submitStatus={submitStatus} onClose={onClose} />}
    >
      <form id={formId} aria-busy={submissionComplete || undefined} onSubmit={submit}>
        <FormField id={`${formId}-category`} label={categoryLabel}>
          <FloatingSelect
            id={`${formId}-category`}
            ariaLabel={categoryLabel}
            value={category}
            options={categoryOptions}
            onChange={onCategoryChange}
            disabled={categoryDisabled || submissionComplete}
          />
        </FormField>
        <FormField id={`${formId}-details`} label="Note *">
          <textarea
            id={`${formId}-details`}
            rows={5}
            maxLength={maxLength}
            value={details}
            required
            disabled={submissionComplete}
            onChange={event => onDetailsChange(event.target.value)}
          />
        </FormField>
        {children}
      </form>
    </Modal>
  );
}
