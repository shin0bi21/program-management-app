import Button from '../../../../components/Button/Button';
import FloatingSelect from '../../../../components/FloatingSelect/FloatingSelect';
import FormField from '../../../../components/FormField/FormField';
import Modal from '../../../../components/Modal/Modal';
import { getSubmitStatusMessage } from '../../../../hooks/useSubmitStatus';
import { OTHER_TIME_ENTRY_CATEGORY_OPTIONS } from '../../timeEntryOptions';
import type { TimeEntryCategory } from '../../types';
import useTimeEntryModal, { type UseTimeEntryModalOptions } from './hooks/useTimeEntryModal';
import './TimeEntryModal.css';

interface TimeEntryModalProps extends UseTimeEntryModalOptions {
  onClose: () => void;
  staffLocked?: boolean;
}

export default function TimeEntryModal({
  isOpen,
  resources,
  programs,
  onClose,
  onAdd,
  initialResourceId,
  initialDate,
  initialSource = 'regular',
  staffLocked = false,
  initialTask,
  initialItem,
  canCompleteTask = false,
}: TimeEntryModalProps) {
  const workflow = useTimeEntryModal({
    isOpen,
    resources,
    programs,
    onAdd,
    initialResourceId,
    initialDate,
    initialSource,
    initialTask,
    initialItem,
    canCompleteTask,
  });
  const { draft } = workflow;
  const submissionComplete = workflow.submitting || workflow.submitStatus === 'success';

  const statusMessage = getSubmitStatusMessage(
    workflow.submitStatus,
    workflow.error,
    {
      submitting: initialItem ? 'Updating logged hours...' : 'Logging hours...',
      success: initialItem ? 'Logged hours updated.' : 'Hours logged successfully.',
    },
  );

  const footer = <>
    <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>
      Cancel
    </Button>
    <Button
      type="submit"
      form="time-entry-form"
      disabled={submissionComplete || !resources.length || (
        draft.source === 'task'
          ? !draft.taskId
          : draft.source === 'session' ? !draft.sessionId : false
      )}
    >
      {initialItem ? 'Save changes' : 'Log hours'}
    </Button>
  </>;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialItem ? 'Edit Logged Hours' : 'Log Hours'}
      maxWidth="620px"
      status={workflow.submitStatus}
      statusMessage={statusMessage}
      successDelay={1200}
      footer={footer}
    >
      <form id="time-entry-form" className="time-entry-form" onSubmit={workflow.submit}>
        <div className="time-entry-form__staff">
          <FormField id="time-entry-staff" label="Staff member">
            <FloatingSelect
              id="time-entry-staff"
              value={draft.resourceId}
              options={resources.map(resource => ({ value: resource.id, label: resource.name }))}
              onChange={workflow.selectResource}
              placeholder="Select staff member"
              ariaLabel="Staff member"
              disabled={submissionComplete
                || resources.length === 0
                || workflow.taskLocked
                || staffLocked}
            />
          </FormField>
        </div>

        {draft.source === 'task' && (
          <div className="time-entry-form__source">
            <FormField
              id="time-entry-assigned-task"
              label="Task *"
              error={workflow.tasksError}
            >
              <FloatingSelect
                id="time-entry-assigned-task"
                value={draft.taskId}
                options={workflow.taskOptions.map(task => ({ value: task.id, label: task.title }))}
                onChange={workflow.selectTask}
                placeholder={workflow.tasksLoading ? 'Loading assigned tasks…' : 'Select assigned task'}
                ariaLabel="Task"
                disabled={submissionComplete || workflow.tasksLoading || workflow.taskLocked}
              />
            </FormField>
          </div>
        )}

        {draft.source === 'task' && !initialItem && canCompleteTask && (
          <label className="time-entry-form__complete-task">
            <input
              type="checkbox"
              checked={draft.completeTask}
              onChange={event => workflow.setCompleteTask(event.target.checked)}
              disabled={submissionComplete}
            />
            Mark task complete
          </label>
        )}

        {draft.source === 'session' && (
          <div className="time-entry-form__source">
            <FormField id="time-entry-session" label="Session *" error={workflow.sessionsError}>
              <FloatingSelect
                id="time-entry-session"
                value={draft.sessionId}
                options={workflow.sessionOptions.map(session => ({
                  value: session.id,
                  label: session.label,
                }))}
                onChange={workflow.selectSession}
                placeholder={workflow.sessionsLoading
                  ? 'Loading sessions…'
                  : !workflow.sessionOptions.length
                    ? 'No sessions on this date'
                    : 'Select session'}
                ariaLabel="Session"
                disabled={submissionComplete || workflow.sessionsLoading}
              />
            </FormField>
          </div>
        )}

        {draft.source === 'regular' && <>
          <FormField id="time-entry-program" label="Program (optional)">
            <FloatingSelect
              id="time-entry-program"
              value={draft.programId}
              options={programs.map(program => ({ value: program.id, label: program.name }))}
              onChange={workflow.selectProgram}
              placeholder="Select a program"
              ariaLabel="Program"
              disabled={submissionComplete}
              action={draft.programId
                ? { label: 'Clear program', onSelect: () => workflow.selectProgram('') }
                : undefined}
            />
          </FormField>

          <FormField id="time-entry-category" label="Category *">
            <FloatingSelect
              id="time-entry-category"
              value={draft.category}
              options={OTHER_TIME_ENTRY_CATEGORY_OPTIONS}
              onChange={value => workflow.selectCategory(
                value as Exclude<TimeEntryCategory, 'program_delivery'>,
              )}
              ariaLabel="Category"
              disabled={submissionComplete}
            />
          </FormField>
        </>}

        <FormField id="time-entry-date" label="Date">
          <input
            id="time-entry-date"
            type="date"
            value={draft.date}
            onChange={event => workflow.updateDate(event.target.value)}
            required
            disabled={submissionComplete || (draft.source === 'session' && Boolean(initialDate))}
          />
        </FormField>

        <FormField id="time-entry-hours" label="Hours">
          <input
            id="time-entry-hours"
            type="number"
            min="0.25"
            max="24"
            step="0.25"
            value={draft.hours}
            onChange={event => workflow.updateHours(event.target.value)}
            required
            disabled={submissionComplete}
          />
        </FormField>

        <div className="time-entry-form__note">
          <FormField id="time-entry-note" label="Note">
            <textarea
              id="time-entry-note"
              value={draft.note}
              onChange={event => workflow.updateNote(event.target.value)}
              rows={5}
              maxLength={2000}
              required
              disabled={submissionComplete}
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
