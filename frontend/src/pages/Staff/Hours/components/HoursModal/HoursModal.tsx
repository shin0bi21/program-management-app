import Button from '../../../../../common/components/Button/Button';
import FloatingSelect from '../../../../../common/components/FloatingSelect/FloatingSelect';
import FormField from '../../../../../common/components/FormField/FormField';
import Modal from '../../../../../common/components/Modal/Modal';
import { getSubmitStatusMessage } from '../../../../../common/hooks/useSubmitStatus';
import type { HoursCategory } from '../../types';
import useHoursModal, { type UseHoursModalOptions } from './hooks/useHoursModal';
import './HoursModal.css';

interface HoursModalProps extends UseHoursModalOptions {
  isOpen: boolean;
  onClose: () => void;
  categories: ReadonlyArray<{ id: HoursCategory; name: string }>;
}

/**
 * Mounts an Hours form only while its add/edit interaction is open.
 * Saved entries and contextual staff/task targets lock staff; other additions default to the signed-in staff member.
 * @param props - Visibility, supplied entry/context, page references and save/close callbacks.
 * @example <HoursModal isOpen item={entry} {...options} />
 */
export default function HoursModal({ isOpen, ...props }: HoursModalProps) {
  if (!isOpen) return null;

  let targetKey = 'new';
  if (props.task) targetKey = `task:${props.task.id}`;
  if (props.item) targetKey = `entry:${props.item.id}`;
  return <HoursForm key={targetKey} {...props} />;
}

/** Owns the mounted Hours form and its draft. @example <HoursForm {...options} /> */
function HoursForm({
  staff,
  programs,
  loadTasks,
  onClose,
  onAdd,
  staffId,
  date,
  source = 'regular',
  task,
  item,
  canCompleteTask = false,
  categories,
}: Omit<HoursModalProps, 'isOpen'>) {
  const workflow = useHoursModal({
    staff,
    programs,
    loadTasks,
    onAdd,
    staffId,
    date,
    source,
    task,
    item,
    canCompleteTask,
  });
  const { draft } = workflow;
  const submissionComplete = workflow.submitting || workflow.submitStatus === 'success';
  const isTaskEntry = draft.source === 'task';
  const isSessionEntry = draft.source === 'session';
  const isRegularEntry = draft.source === 'regular';
  const staffLocked = Boolean(item || task || staffId);
  const sessionDateLocked = isSessionEntry && Boolean(item || date);
  const sourceMissing = (isTaskEntry && !draft.taskId) || (isSessionEntry && !draft.sessionId);
  const submitDisabled = submissionComplete || !staff.length || !draft.staffId || sourceMissing;
  let sessionPlaceholder = workflow.sessionOptions.length ? 'Select session' : 'No sessions on this date';
  if (workflow.sessionsLoading) sessionPlaceholder = 'Loading sessions…';

  const statusMessage = getSubmitStatusMessage(
    workflow.submitStatus,
    workflow.error,
    {
      submitting: item ? 'Updating logged hours...' : 'Logging hours...',
      success: item ? 'Logged hours updated.' : 'Hours logged successfully.',
    },
  );

  const footer = <>
    <Button variant="secondary" onClick={onClose} disabled={submissionComplete}>
      Cancel
    </Button>
    <Button
      type="submit"
      form="hours-form"
      disabled={submitDisabled}
    >
      Save
    </Button>
  </>;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? 'Edit Logged Hours' : 'Log Hours'}
      maxWidth="620px"
      status={workflow.submitStatus}
      statusMessage={statusMessage}
      footer={footer}
    >
      <form id="hours-form" className="hours-form" onSubmit={workflow.submit}>
        <div className="hours-form__staff">
          <FormField id="hours-staff" label="Staff member">
            <FloatingSelect
              id="hours-staff"
              value={draft.staffId}
              options={staff.map(({ id, name }) => ({ id, label: name }))}
              onChange={workflow.selectStaff}
              placeholder="Select staff member"
              ariaLabel="Staff member"
              disabled={submissionComplete
                || staff.length === 0
                || staffLocked}
            />
          </FormField>
        </div>

        {isTaskEntry && (
          <div className="hours-form__source">
            <FormField
              id="hours-assigned-task"
              label="Task *"
              error={workflow.tasksError}
            >
              <FloatingSelect
                id="hours-assigned-task"
                value={draft.taskId}
                options={workflow.taskOptions.map(task => ({ id: task.id, label: task.title }))}
                onChange={workflow.selectTask}
                placeholder={workflow.tasksLoading ? 'Loading assigned tasks…' : 'Select assigned task'}
                ariaLabel="Task"
                disabled={submissionComplete || workflow.tasksLoading || workflow.taskLocked}
              />
            </FormField>
          </div>
        )}

        {isTaskEntry && !item && canCompleteTask && (
          <label className="hours-form__complete-task">
            <input
              type="checkbox"
              checked={draft.completeTask}
              onChange={event => workflow.setCompleteTask(event.target.checked)}
              disabled={submissionComplete}
            />
            Task completed
          </label>
        )}

        {isSessionEntry && (
          <div className="hours-form__source">
            <FormField id="hours-session" label="Session *" error={workflow.sessionsError}>
              <FloatingSelect
                id="hours-session"
                value={draft.sessionId}
                options={workflow.sessionOptions.map(({ id, name }) => ({ id, label: name }))}
                onChange={workflow.selectSession}
                placeholder={sessionPlaceholder}
                ariaLabel="Session"
                disabled={submissionComplete || workflow.sessionsLoading}
              />
            </FormField>
          </div>
        )}

        {isRegularEntry && <>
          <FormField id="hours-program" label="Program (optional)">
            <FloatingSelect
              id="hours-program"
              value={draft.programId}
              options={programs.map(({ id, title }) => ({ id, label: title }))}
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
              options={categories.filter(option => option.id !== 'program_delivery').map(({ id, name }) => ({ id, label: name }))}
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
            disabled={submissionComplete || sessionDateLocked}
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
