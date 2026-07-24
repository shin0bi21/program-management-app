export interface Program {
  id: string;
  name: string;
  description?: string | null;
}

export interface CreateProgramInput {
  name: string;
  description?: string | null;
}
