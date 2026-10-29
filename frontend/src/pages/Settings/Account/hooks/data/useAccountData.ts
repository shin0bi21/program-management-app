import { useAuth } from '../../../../../auth/authContext';
import { getUser } from '../../../../../auth/storage';
import { useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';

import type { AccountPageData } from '../../types';

export default function useAccountData(): AccountPageData {
  const user = getUser();
  const { role } = useAuth();
  const {
    rows: programs,
    loading: programsLoading,
    error: programsError,
    refetch: retryPrograms,
  } = useProgramReferences({ assignedOnly: true });

  return {
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    email: user?.email ?? '—',
    role: role ?? '—',
    programNames: programs.map(program => program.name).join(', '),
    programsLoading,
    programsError,
    retryPrograms,
  };
}
