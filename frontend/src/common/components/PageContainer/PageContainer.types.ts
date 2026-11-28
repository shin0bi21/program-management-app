import type { FilterCardCategory, FilterCardValues } from '../FilterCard/types';

type PageView = 'table' | 'calendar';

export interface PageSearchControls {
  appliedValue: string;
  apply: (search: string) => void;
}

export interface PageFilterControls<Values extends FilterCardValues = FilterCardValues> {
  definitions: (Omit<FilterCardCategory, 'id'> & { id: Extract<keyof NoInfer<Values>, string> })[];
  values: Values;
  update: (patch: Partial<NoInfer<Values>>) => void;
}

interface PageControlGroups<Values extends FilterCardValues> {
  /** Whether saved page inputs have finished restoring; false keeps controls and data views unmounted. */
  ready: boolean;
  search?: PageSearchControls;
  filters?: PageFilterControls<Values>;
  table?: {
    hiddenColumns: string[];
    setHiddenColumns: (keys: string[]) => void;
  };
}

export type PageControls<Values extends FilterCardValues = FilterCardValues> = PageControlGroups<Values> & (
  | { view?: never; setView?: never }
  | { view: PageView; setView: (view: PageView) => void }
);

export type PageViewControls<Values extends FilterCardValues = FilterCardValues> = PageControlGroups<Values> & {
  view: PageView;
  setView: (view: PageView) => void;
};
