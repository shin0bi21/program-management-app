export type ListSortValue = string | number | boolean | Date | null;

export interface ListOrdering<T> {
  getValue: (row: T) => ListSortValue;
  direction: 'asc' | 'desc';
}

/**
 * Compares server-compatible sort values, keeping nulls last in either direction.
 * @param left - First value using the server sort expression's normalization and type.
 * @param right - Second value using the same normalization and type.
 * @param direction - Order for populated values; null placement does not reverse.
 * @example compareListSortValues(null, 'alpha', 'desc') // 1
 */
export function compareListSortValues(left: ListSortValue, right: ListSortValue, direction: 'asc' | 'desc' = 'asc'): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  const multiplier = direction === 'asc' ? 1 : -1;
  if (typeof left === 'string' && typeof right === 'string') {
    const firstCharacters = [...left];
    const secondCharacters = [...right];
    for (let index = 0; index < Math.min(firstCharacters.length, secondCharacters.length); index += 1) {
      const comparison = firstCharacters[index].codePointAt(0)! - secondCharacters[index].codePointAt(0)!;
      if (comparison !== 0) return Math.sign(comparison) * multiplier;
    }
    return Math.sign(firstCharacters.length - secondCharacters.length) * multiplier;
  }

  const first = left instanceof Date ? left.getTime() : left;
  const second = right instanceof Date ? right.getTime() : right;
  if (first === second) return 0;
  return (first < second ? -1 : 1) * multiplier;
}

/**
 * Detects edited rows out of server order among loaded neighbors, with nulls last.
 * @param rows - Loaded records in their retained display positions.
 * @param editedIds - Records whose sort values changed after loading.
 * @param ordering - Server-compatible value projection and direction; UUID ties follow that direction.
 * @example Renaming the first ascending row from Amy to Zoe before Bob returns true.
 */
export function hasMisplacedListRows<T extends { id: string }>(
  rows: readonly T[],
  editedIds: ReadonlySet<string>,
  ordering: ListOrdering<T>,
): boolean {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (!editedIds.has(previous.id) && !editedIds.has(current.id)) continue;

    const valueComparison = compareListSortValues(ordering.getValue(previous), ordering.getValue(current), ordering.direction);
    const comparison = valueComparison || compareListSortValues(previous.id, current.id, ordering.direction);
    if (comparison > 0) return true;
  }
  return false;
}
