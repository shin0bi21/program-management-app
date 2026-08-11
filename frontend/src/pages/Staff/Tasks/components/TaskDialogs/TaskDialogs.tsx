import Modal from '../../../../../common/components/Modal/Modal';
import { useConfirmModal, type ConfirmAction } from '../../../../../common/components/Modal/hooks/useConfirmModal';
import TimeEntryModal from '../../../../../common/features/timeEntries/components/TimeEntryModal/TimeEntryModal';
import type { SetTimeEntryInput } from '../../../../../common/features/timeEntries/api/timeEntries.api';
import type {
  Task,
  TaskCycle,
  TaskProgram,
  TaskResource,
} from '../../../../../common/features/tasks/types';
import TaskManagementModal from '../TaskManagementModal/TaskManagementModal';

export type TaskModalTarget = Task | {
  startDate: string;
  dueDate: string;
  fixedStaffId?: string;
};

export default function TaskDialogs({
  canWrite,
  modalTarget,
  logHoursTask,
  confirmAction,
  resources,
  writableResources,
  programs,
  cycles,
  onTaskSaved,
  onCloseTask,
  onLogHours,
  onCloseLogHours,
  onCloseConfirmation,
}: {
  canWrite: boolean;
  modalTarget: TaskModalTarget | null;
  logHoursTask: Task | null;
  confirmAction: ConfirmAction | null;
  resources: TaskResource[];
  writableResources: TaskResource[];
  programs: TaskProgram[];
  cycles: TaskCycle[];
  onTaskSaved: (task: Task) => void;
  onCloseTask: () => void;
  onLogHours: (input: SetTimeEntryInput) => Promise<void>;
  onCloseLogHours: () => void;
  onCloseConfirmation: () => void;
}) {
  const confirmModal = useConfirmModal({ action: confirmAction, onClose: onCloseConfirmation });
  const editingTask = modalTarget && 'id' in modalTarget ? modalTarget : undefined;
  const newTaskTarget = modalTarget && !('id' in modalTarget) ? modalTarget : undefined;

  return <>
    {canWrite && modalTarget && <TaskManagementModal
      isOpen
      task={editingTask}
      initialStartDate={newTaskTarget?.startDate}
      initialDueDate={newTaskTarget?.dueDate}
      fixedStaffId={newTaskTarget?.fixedStaffId}
      resources={writableResources}
      programs={programs}
      cycles={cycles}
      onSaved={onTaskSaved}
      onClose={onCloseTask}
    />}
    {logHoursTask && <TimeEntryModal
      isOpen
      initialSource="task"
      initialTask={logHoursTask}
      initialResourceId={logHoursTask.assignee.id}
      resources={resources}
      programs={programs}
      cycles={cycles}
      onAdd={onLogHours}
      onClose={onCloseLogHours}
    />}
    <Modal
      isOpen={confirmAction !== null}
      onClose={onCloseConfirmation}
      title={confirmAction?.title ?? ''}
      status={confirmModal.status}
      statusMessage={confirmModal.statusMessage}
      footer={confirmModal.footer}
      successDelay={confirmModal.successDelay}
    >
      {confirmAction && <p>{confirmAction.message}</p>}
    </Modal>
  </>;
}
