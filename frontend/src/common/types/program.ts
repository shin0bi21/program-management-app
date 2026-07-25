export interface Program {
  id: string;
  name: string;
  description?: string | null;
  rosterMode: 'enrolled' | 'open';
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
  rosterMode?: 'enrolled' | 'open';
}
