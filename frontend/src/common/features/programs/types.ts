export interface Program {
  id: string;
  name: string;
  description?: string | null;
  rosterMode: 'enrolled' | 'open';
  minAge: number | null;
  maxAge: number | null;
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  rosterMode?: 'enrolled' | 'open';
  minAge?: number | null;
  maxAge?: number | null;
}

export type UpdateProgramInput = CreateProgramInput;
