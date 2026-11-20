import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useCycleReferences, useProgramReferences, useStaffReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getTaskReferenceData, type TaskReferenceData } from '../../api/tasks.api';
import type { CycleReference } from '../../../../../common/features/referenceData/referenceData.api';
import type { StaffReference, TaskProgram } from '../../types';

interface TaskDataResult {
  cycles: CycleReference[];
  cyclesLoading: boolean;
  cyclesError: string;
  referenceData: TaskReferenceData | undefined;
  referenceDataLoading: boolean;
  referenceDataError: Error | null;
  staff: StaffReference[];
  staffLoading: boolean;
  staffError: string;
  programs: TaskProgram[];
  programsLoading: boolean;
  programsError: string;
  writableStaff: StaffReference[];
}

/**
 * Supplies shared staff, program, cycle, and task choices.
 * @param referenceDataQueryKey - Cache key for task categories and lifecycle statuses.
 * @example const { staff, cycles } = useTaskData(['task-reference-data'])
 */
export default function useTaskData(referenceDataQueryKey: readonly unknown[]): TaskDataResult {
  const query = useQuery({
    queryKey: referenceDataQueryKey,
    queryFn: ({ signal }) => getTaskReferenceData({ signal }),
  });

  const cyclesQuery = useCycleReferences();
  const programsQuery = useProgramReferences();
  const staffQuery = useStaffReferences('tasks');
  const staff = staffQuery.rows;

  const writableStaff = useMemo(
    () => staff.filter(staffMember => staffMember.writable),
    [staff],
  );

  return {
    cycles: cyclesQuery.rows,
    cyclesLoading: cyclesQuery.loading,
    cyclesError: cyclesQuery.error,
    referenceData: query.data,
    referenceDataLoading: query.isLoading,
    referenceDataError: query.error,
    staff,
    staffLoading: staffQuery.loading,
    staffError: staffQuery.error,
    programs: programsQuery.rows,
    programsLoading: programsQuery.loading,
    programsError: programsQuery.error,
    writableStaff,
  };
}
