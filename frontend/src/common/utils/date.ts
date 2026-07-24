const shortDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatShortDate(value: string | number | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return shortDateFormatter.format(new Date(year, month - 1, day, 12));
  }
  return shortDateFormatter.format(value instanceof Date ? value : new Date(value));
}
