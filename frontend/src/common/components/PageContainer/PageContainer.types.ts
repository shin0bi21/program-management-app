import type { ComponentProps } from 'react';
import type FilterCard from '../FilterCard/FilterCard';

type PageView = 'table' | 'calendar';

export interface PageSearchControls {
  value: string;
  setValue: (value: string) => void;
  appliedValue: string;
  apply: () => void;
  clear: () => void;
}

interface PageControlGroups {
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
