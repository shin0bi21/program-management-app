import { useCallback, useState } from 'react';

import type { ConfirmAction } from '../../../../../common/components/ConfirmModal/types';
import { deleteProgramCycle } from '../../../../Programming/Cohorts/cohorts.api';
import type { ProgramCycle } from '../../../../Programming/Cohorts/types';

interface UseProgrammingActionsOptions {
  onCycleDeleted: (cycleId: string) => void;
}

export default function useProgrammingActions({ onCycleDeleted }: UseProgrammingActionsOptions) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const requestCycleDeletion = useCallback((cycle: ProgramCycle) => {
    setConfirmAction({
      title: 'Delete Cycle',
      message: `Delete ${cycle.name}? Cycles assigned to cohorts or logged hours cannot be deleted.`,
      confirmLabel: 'Delete',
      confirmVariant: 'danger',
      successMessage: 'Cycle deleted',
      onConfirm: async () => {
        await deleteProgramCycle(cycle.id);
        onCycleDeleted(cycle.id);
      },
    });
  }, [onCycleDeleted]);

  const closeConfirmation = useCallback(() => setConfirmAction(null), []);

  return { confirmAction, requestCycleDeletion, closeConfirmation };
}
