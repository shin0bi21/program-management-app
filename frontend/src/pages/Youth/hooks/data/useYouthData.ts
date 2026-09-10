import { usePrograms } from '../../../../common/features/programs/hooks/usePrograms';
import useListQuery from '../../../../query/hooks/useListQuery';
import { getProgramCycles } from '../../../Programming/Cohorts/cohorts.api';

export default function useYouthData(assignedOnly: boolean) {
  const programs = usePrograms({ assignedOnly });
  const cycles = useListQuery({
    queryKey: ['program-cycles'],
    queryFn: ({ signal }) => getProgramCycles({ signal }),
    errorMessage: 'Could not load cycles',
  });

  return {
    programs: programs.programs,
    programsLoading: programs.loading,
    programsError: programs.error,
    cycles: cycles.rows,
    cyclesLoading: cycles.loading,
    cyclesError: cycles.error,
  };
}
