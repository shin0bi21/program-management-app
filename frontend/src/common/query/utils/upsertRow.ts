export default function upsertRow<T extends { id: string }>(rows: T[], updatedRow: T): T[] {
  const exists = rows.some(row => row.id === updatedRow.id);
  if (!exists) return [...rows, updatedRow];

  return rows.map(row => (
    row.id === updatedRow.id ? updatedRow : row
  ));
}
