import { useQuery } from '@tanstack/react-query';

import {
  useCycleReferences,
  useProgramReferences,
  useStaffReferences,
  type ReferenceDataQuery,
} from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getTaskReferenceData, type TaskReferenceData } from '../../api/tasks.api';
import type { CycleReference, ProgramReference, StaffReference } from '../../../../../common/features/referenceData/referenceData.api';

export type TaskReferences = {
  cycles: ReferenceDataQuery<CycleReference[]>;
  taskOptions: ReferenceDataQuery<TaskReferenceData>;
  staff: ReferenceDataQuery<StaffReference[]>;
  programs: ReferenceDataQuery<ProgramReference[]>;
};

/**
 * Supplies shared staff, program, cycle, and task choices.
 * @example const { staff, cycles } = useTaskReferenceData()
 */
export default function useTaskReferenceData(): TaskReferences {
  const taskOptions = useQuery({
    queryKey: ['task-reference-data'],
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const cycles = useCycleReferences();
  const programs = useProgramReferences();
  const staff = useStaffReferences('tasks');
  return {
    cycles,
    taskOptions,
    staff,
    programs,
  };
}
