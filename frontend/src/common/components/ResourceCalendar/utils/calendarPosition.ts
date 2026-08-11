export type CalendarPositionEdge = 'left' | 'right';

export interface CalendarPosition {
  date: Date;
  edge: CalendarPositionEdge;
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
  if (!storageKey) return { date: fallbackDate, edge: 'left' };
  const stored = localStorage.getItem(storageKey);
  if (!stored) return { date: fallbackDate, edge: 'left' };

  const [dateKey, edge, extra] = stored.split('|');
  const date = parseCalendarDate(dateKey);
  if (!date || (edge !== 'left' && edge !== 'right') || extra !== undefined) {
    localStorage.removeItem(storageKey);
    return { date: fallbackDate, edge: 'left' };
  }
  return { date, edge };
}

export function saveCalendarPosition(
  storageKey: string | undefined,
  dateKey: string,
  edge: CalendarPositionEdge,
) {
  if (storageKey) localStorage.setItem(storageKey, `${dateKey}|${edge}`);
}

export function calculateCalendarAnchorScrollLeft({
  periodIndex,
  edge,
  periodWidth,
  viewportWidth,
  coveredLeftWidth,
}: {
  periodIndex: number;
  edge: CalendarPositionEdge;
  periodWidth: number;
  viewportWidth: number;
  coveredLeftWidth: number;
}) {
  if (edge === 'left') return periodIndex * periodWidth;
  const visiblePeriodWidth = viewportWidth - coveredLeftWidth;
  return Math.max(0, (periodIndex + 1) * periodWidth - visiblePeriodWidth);
}
