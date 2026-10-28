export interface HomepageSession {
  id: string;
  theme: string;
  startsAt: string;
}

export interface HomepageProgram {
  id: string;
  name: string;
  description: string | null;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  sessions: HomepageSession[];
}
