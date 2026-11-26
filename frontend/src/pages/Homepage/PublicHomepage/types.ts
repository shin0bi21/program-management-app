import type { Session } from '../../../common/features/programming/sessions/types';

export type HomepageSession = Pick<Session, 'id' | 'title' | 'date'>;

export interface HomepageProgram {
  id: string;
  title: string;
  description: string | null;
  enrollmentRequired: boolean;
  minAge: number | null;
  maxAge: number | null;
  sessions: HomepageSession[];
}
