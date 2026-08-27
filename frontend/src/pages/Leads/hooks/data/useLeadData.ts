import { usePrograms } from '../../../../common/features/programs/hooks/usePrograms';

export default function useLeadData() {
  const {
    programs,
    loading: programsLoading,
    error: programsError,
  } = usePrograms();

  return {
    programs,
    programsLoading,
    programsError,
  };
}
