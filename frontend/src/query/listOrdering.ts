export type ListSortValue = string | number | boolean | Date | null;

export interface ListOrdering<T> {
  getValue: (row: T) => ListSortValue;
  direction: 'asc' | 'desc';
}

/** Values must use the same normalization and type as the server's sort expression. */
export function compareListSortValues(left: ListSortValue, right: ListSortValue): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;

  if (typeof left === 'string' && typeof right === 'string') {
    const firstCharacters = [...left];
    const secondCharacters = [...right];
    for (let index = 0; index < Math.min(firstCharacters.length, secondCharacters.length); index += 1) {
      const comparison = firstCharacters[index].codePointAt(0)! - secondCharacters[index].codePointAt(0)!;
      if (comparison !== 0) return Math.sign(comparison);
    }
    return Math.sign(firstCharacters.length - secondCharacters.length);
  }

  const first = left instanceof Date ? left.getTime() : left;
  const second = right instanceof Date ? right.getTime() : right;
  if (first === second) return 0;
  return first < second ? -1 : 1;
}

export function hasMisplacedListRows<T extends { id: string }>(
  rows: readonly T[],
  editedIds: ReadonlySet<string>,
  ordering: ListOrdering<T>,
): boolean {
  const direction = ordering.direction === 'asc' ? 1 : -1;
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];
    if (!editedIds.has(previous.id) && !editedIds.has(current.id)) continue;

    const valueComparison = compareListSortValues(ordering.getValue(previous), ordering.getValue(current));
    const comparison = valueComparison || compareListSortValues(previous.id, current.id);
    if (comparison * direction > 0) return true;
  }
  return false;
}
