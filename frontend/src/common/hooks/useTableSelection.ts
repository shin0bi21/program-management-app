import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useTableSelection<T extends { id: string }>(data: T[]) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedItem = useMemo(
    () => data.find(item => item.id === selectedKey) ?? null,
    [data, selectedKey],
  );

  useEffect(() => {
    if (selectedKey && !selectedItem) setSelectedKey(null);
  }, [selectedItem, selectedKey]);

  const selectItem = useCallback((item: T) => setSelectedKey(item.id), []);

  return {
    selectedItem,
    selectedKey,
    selectItem,
  };
}
