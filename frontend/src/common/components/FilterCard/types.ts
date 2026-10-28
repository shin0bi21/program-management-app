import type { DateRange } from '../../utils/dateRange';

export interface DateRangePreset {
  id: string;
  label: string;
  range: DateRange;
}

export interface FilterCardOption {
  value: string;
  label: string;
}

export interface FilterCardCategory {
  id: string;
  label: string;
  options: FilterCardOption[];
  selectionMode?: 'single' | 'multiple';
}

export type FilterCardValues = Record<string, string[]>;
