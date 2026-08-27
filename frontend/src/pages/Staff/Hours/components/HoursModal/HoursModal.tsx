import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import { getSubmitStatusMessage } from '../../../../../common/hooks/useSubmitStatus';
import type { HoursCategory } from '../../types';
import useHoursModal, { type UseHoursModalOptions } from './hooks/useHoursModal';
import './HoursModal.css';

interface HoursModalProps extends UseHoursModalOptions {
  onClose: () => void;
  staffLocked?: boolean;
  categories: ReadonlyArray<{ value: HoursCategory; label: string }>;
}

export default function HoursModal({
  isOpen,
  resources,
  programs,
  loadTasks,
  onClose,
  onAdd,
  initialResourceId,
  initialDate,
  initialSource = 'regular',
  staffLocked = false,
  initialTask,
  initialItem,
  canCompleteTask = false,
  categories,
}: HoursModalProps) {
  const workflow = useHoursModal({
    isOpen,
    resources,
    programs,
    loadTasks,
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
      form="hours-form"
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
      <form id="hours-form" className="hours-form" onSubmit={workflow.submit}>
        <div className="hours-form__staff">
          <FormField id="hours-staff" label="Staff member">
            <FloatingSelect
              id="hours-staff"
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
          <div className="hours-form__source">
            <FormField
              id="hours-assigned-task"
              label="Task *"
              error={workflow.tasksError}
            >
              <FloatingSelect
                id="hours-assigned-task"
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
          <label className="hours-form__complete-task">
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
          <div className="hours-form__source">
            <FormField id="hours-session" label="Session *" error={workflow.sessionsError}>
              <FloatingSelect
                id="hours-session"
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
          <FormField id="hours-program" label="Program (optional)">
            <FloatingSelect
              id="hours-program"
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

          <FormField id="hours-category" label="Category *">
            <FloatingSelect
              id="hours-category"
              value={draft.category}
              options={categories.filter(option => option.value !== 'program_delivery')}
              onChange={value => workflow.selectCategory(
                value as Exclude<HoursCategory, 'program_delivery'>,
              )}
              ariaLabel="Category"
              disabled={submissionComplete}
            />
          </FormField>
        </>}

        <FormField id="hours-date" label="Date">
          <input
            id="hours-date"
            type="date"
            value={draft.date}
            onChange={event => workflow.updateDate(event.target.value)}
            required
            disabled={submissionComplete || (draft.source === 'session' && Boolean(initialDate))}
          />
        </FormField>

        <FormField id="hours-duration" label="Hours">
          <input
            id="hours-duration"
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

        <div className="hours-form__note">
          <FormField id="hours-note" label="Note">
            <textarea
              id="hours-note"
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
