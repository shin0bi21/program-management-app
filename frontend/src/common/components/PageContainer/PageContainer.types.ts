import type { ComponentProps } from 'react';
import type FilterCard from '../FilterCard/FilterCard';

type PageView = 'table' | 'calendar';

export interface PageSearchControls {
  appliedValue: string;
  apply: (search: string) => void;
}

interface PageControlGroups {
  /** Whether saved page inputs have finished restoring; false keeps controls and data views unmounted. */
  ready: boolean;
  search?: PageSearchControls;
  filters?: {
    definitions: ComponentProps<typeof FilterCard>['categories'];
    values: ComponentProps<typeof FilterCard>['values'];
    apply: (id: string, selected: string[]) => void;
    clear: () => void;
  };
  table?: {
    hiddenColumns: string[];
    setHiddenColumns: (keys: string[]) => void;
  };
}

export type PageControls = PageControlGroups & (
  | { view?: never; setView?: never }
  | { view: PageView; setView: (view: PageView) => void }
);

export type PageViewControls = PageControlGroups & {
  view: PageView;
  setView: (view: PageView) => void;
};
