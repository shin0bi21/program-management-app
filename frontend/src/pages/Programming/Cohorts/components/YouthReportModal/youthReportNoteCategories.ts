import type { SessionNoteCategory } from '../../../../../common/types/cohort';

export const youthReportNoteCategories: Record<SessionNoteCategory, {
  label: string;
  marker: string;
  color: string;
}> = {
  general: { label: 'General', marker: 'G', color: '#59636e' },
  attendance: { label: 'Attendance', marker: 'AT', color: '#1565c0' },
  behaviour: { label: 'Behaviour', marker: 'B', color: '#c53030' },
  achievement: { label: 'Achievement', marker: 'AC', color: '#166534' },
  follow_up: { label: 'Follow-up', marker: 'F', color: '#d95f02' },
};
