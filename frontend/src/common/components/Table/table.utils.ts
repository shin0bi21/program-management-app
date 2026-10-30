export const MIN_COLUMN_WIDTH = 100;
export const MAX_COLUMN_WIDTH = 500;
export const DEFAULT_COLUMN_WIDTH = 150;
export const FIXED_COLUMN_WIDTH = 40;
export const RESIZE_KEYBOARD_STEP = 10;
export const INFINITE_SCROLL_ROOT_MARGIN = '300px 0px';

export function clampColumnWidth(width: number, min = MIN_COLUMN_WIDTH, max = MAX_COLUMN_WIDTH): number {
  return Math.min(MAX_COLUMN_WIDTH, max, Math.max(MIN_COLUMN_WIDTH, min, width));
}

export function ariaSortFor(direction: false | 'asc' | 'desc'): 'ascending' | 'descending' | undefined {
  if (direction === 'asc') return 'ascending';
  if (direction === 'desc') return 'descending';
  return undefined;
}
