export interface ProgramCycle {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: 'upcoming' | 'active' | 'completed';
}
