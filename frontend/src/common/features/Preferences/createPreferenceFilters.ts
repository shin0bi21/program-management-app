import type { FilterCardCategory } from '../../components/FilterCard/FilterCard';

type FilterValues = Record<string, string[]>;

type FilterDefinition<T extends FilterValues> = Omit<FilterCardCategory, 'id'> & {
  id: Extract<keyof T, string>;
};

interface PreferenceFilterOptions<T extends FilterValues> {
  values: T;
  definitions: FilterDefinition<NoInfer<T>>[];
  updatePreferences: (patch: Partial<NoInfer<T>>) => void;
}

// Field normalization and persistence remain with usePreferences; this adapter owns filter commands.
export default function createPreferenceFilters<T extends FilterValues>({
  values,
  definitions,
  updatePreferences,
}: PreferenceFilterOptions<T>) {
  const apply = (id: string, selected: string[]) => {
    const definition = definitions.find(filter => filter.id === id);
    if (!definition) return;

    // The definition ties this dynamic key to a selected array; preference rules validate its contents.
    updatePreferences({ [definition.id]: selected } as Partial<T>);
  };

  const clear = () => {
    const patch = Object.fromEntries(Object.keys(values).map(key => [key, [] as string[]])) as Partial<T>;
    updatePreferences(patch);
  };

  return { values, definitions, apply, clear };
}
