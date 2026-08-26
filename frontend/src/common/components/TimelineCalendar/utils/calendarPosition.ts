export interface CalendarPosition {
  date: Date;
  offset: number;
}

function parseCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const valid = date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3]);
  return valid ? date : null;
}

export function loadCalendarPosition(storageKey: string | undefined, fallbackDate: Date): CalendarPosition {
  if (!storageKey) return { date: fallbackDate, offset: 0 };
  const stored = localStorage.getItem(storageKey);
  if (!stored) return { date: fallbackDate, offset: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    parsed = null;
  }
  const candidate = parsed as { date?: unknown; offset?: unknown } | null;
  const date = typeof candidate?.date === 'string' ? parseCalendarDate(candidate.date) : null;
  if (!date || typeof candidate?.offset !== 'number' || !Number.isFinite(candidate.offset) || candidate.offset < 0) {
    localStorage.removeItem(storageKey);
    return { date: fallbackDate, offset: 0 };
  }
  return { date, offset: candidate.offset };
}

export function saveCalendarPosition(
  storageKey: string | undefined,
  dateKey: string,
  offset: number,
) {
  if (storageKey) localStorage.setItem(storageKey, JSON.stringify({ date: dateKey, offset }));
}
