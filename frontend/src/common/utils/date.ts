const shortDateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

export function formatShortDate(value: string | number | Date): string {
  return shortDateFormatter.format(value instanceof Date ? value : new Date(value));
}
