import type { FilterCardOption } from '../../components/FilterCard/types';
import type { NamedReference } from './referenceData.api';

export function toFilterOptions(references: readonly NamedReference[]): FilterCardOption[] {
  return references.map(reference => ({ value: reference.id, label: reference.name }));
}
