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
