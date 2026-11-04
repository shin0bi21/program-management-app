import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getErrorMessage } from '../../../../../../http/errors';
import { getManagedHomepageSignup, updateHomepageSignup } from '../../../signupForm.api';

const queryKey = ['homepage', 'managed', 'signup'] as const;

export function useHomepageSignupSetting() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getManagedHomepageSignup({ signal }),
  });
  const mutation = useMutation({
    mutationFn: updateHomepageSignup,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKey, settings);
      void queryClient.invalidateQueries({ queryKey: ['homepage', 'public', 'signup'] });
    },
  });

  const refresh = async () => {
    mutation.reset();
    await query.refetch();
  };
  const error = mutation.error ?? query.error;

  return {
    signupEnabled: query.data?.signupEnabled,
    loading: query.isLoading,
    saving: mutation.isPending,
    error: error ? getErrorMessage(error, 'Could not load homepage signup') : null,
    refresh,
    setSignupEnabled: mutation.mutate,
  };
}
