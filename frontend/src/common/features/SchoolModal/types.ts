import type { SchoolReference } from '../referenceData/referenceData.api';

export type School = SchoolReference;

export type SchoolAction =
  | { type: 'add' }
  | { type: 'edit'; school: School }
  | { type: 'delete'; school: School };

export interface SchoolSelection {
  schoolId: string;
  onChange: (schoolId: string) => void;
}
