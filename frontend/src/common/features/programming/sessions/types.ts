export type SessionTypeValue = 'Regular' | 'Guest Speaker' | 'Field Trip';

export interface Session {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  cancelledAt: string | null;
  description: string | null;
  cycleId: string;
  sessionType: SessionTypeValue;

  cycle: string;

  programId: string;
  program: string;
  enrollmentRequired: boolean;

  state: 'upcoming' | 'completed' | 'cancelled';
  movable: boolean;
}
