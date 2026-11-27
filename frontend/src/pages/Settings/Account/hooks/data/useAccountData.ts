import { useAuth } from '../../../../../auth/authContext';
import { getUser } from '../../../../../auth/storage';
import { useProgramReferences } from '../../../../../common/features/referenceData/hooks/useReferenceData';
import { getErrorMessage } from '../../../../../http/errors';

import type { AccountPageData } from '../../types';

export default function useAccountData(): AccountPageData {
  const user = getUser();
  const { role } = useAuth();
  const programs = useProgramReferences({ assignedOnly: true });

  return {
    name: [user?.firstName, user?.lastName].filter(Boolean).join(' '),
    email: user?.email ?? '—',
    role: role ?? '—',
    programNames: (programs.data ?? []).map(program => program.title).join(', '),
    programsLoading: programs.isLoading,
    programsError: programs.error ? getErrorMessage(programs.error, 'Could not load programs') : '',
    retryPrograms: async () => { await programs.refetch(); },
  };
}
