export interface FilterCardOption {
  /** Stable choice key, unique within its category and containing no null characters. */
  id: string;
  name: string;
}

export interface FilterCardCategory {
  /** Unique group key matching its entry in FilterCardValues, e.g. 'status'. */
  id: string;
  label: string;
  options: readonly FilterCardOption[];
  /** Defaults to multiple; single replaces the draft choice until it is cleared. */
  selectionMode?: 'single' | 'multiple';
}

/**
 * Applied option IDs without duplicates by group, e.g. { status: ['active'], staff: ['staff-1'] }.
 * Missing groups and empty arrays mean no selection; single-choice groups contain at most one value.
 */
export type FilterCardValues = Record<string, string[]>;
