import { useCallback, useEffect, useState } from 'react';

import type { Program } from '../../../../../common/features/programs/types';
import type { ProgramCycle } from '../../../../../common/types/cohort';

function useSelection<T extends { id: string }>(items: T[]) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    if (selectedKey && !items.some(item => item.id === selectedKey)) setSelectedKey(null);
  }, [items, selectedKey]);

  const selectItem = useCallback((item: T) => setSelectedKey(item.id), []);

  return {
    selectedKey,
    selectItem,
  };
}

export default function useProgrammingSelection(programs: Program[], cycles: ProgramCycle[]) {
  const programSelection = useSelection(programs);
  const cycleSelection = useSelection(cycles);

  return {
    programSelection,
    cycleSelection,
  };
}
