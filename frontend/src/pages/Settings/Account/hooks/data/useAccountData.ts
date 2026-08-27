import { useAuth } from '../../../../../auth/authContext';
import { getUser } from '../../../../../auth/storage';
import { usePrograms } from '../../../../../common/features/programs/hooks/usePrograms';

import type { AccountPageData } from '../../types';

export default function useAccountData(): AccountPageData {
  const user = getUser();
  const { role } = useAuth();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms({ assignedOnly: true });

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
