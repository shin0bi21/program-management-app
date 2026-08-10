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

export function formatShortDateRange(start: string, end: string): string {
  const toLocalDate = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day, 12);
  };
  return shortDateFormatter.formatRange(toLocalDate(start), toLocalDate(end)).replace('–', ' – ');
}

export function getDateKeyInTimeZone(
  value: Date = new Date(),
  timeZone = 'America/Toronto',
): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find(item => item.type === type)?.value ?? ''
  );
  return `${part('year')}-${part('month')}-${part('day')}`;
}
