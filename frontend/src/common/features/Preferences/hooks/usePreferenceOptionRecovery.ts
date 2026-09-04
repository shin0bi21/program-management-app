import { useEffect } from 'react';

interface UsePreferenceOptionRecoveryOptions {
  ready: boolean;
  loading: boolean;
  error: boolean;
  selectedIds: readonly string[];
  availableIds: readonly string[];
  onReconcile: (selectedIds: string[]) => void;
}

function equalIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export default function usePreferenceOptionRecovery({
  ready,
  loading,
  error,
  selectedIds,
  availableIds,
  onReconcile,
}: UsePreferenceOptionRecoveryOptions) {
  useEffect(() => {
    if (!ready || loading || error) return;
    const available = new Set(availableIds);
    const reconciled = selectedIds.filter(id => available.has(id));
    if (!equalIds(selectedIds, reconciled)) onReconcile(reconciled);
  }, [availableIds, error, loading, onReconcile, ready, selectedIds]);
}
