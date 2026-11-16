export interface HomepageSession {
  id: string;
  title: string;
  date: string;
}

export interface HomepageProgram {
  id: string;
  title: string;
  description: string | null;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  sessions: HomepageSession[];
}
