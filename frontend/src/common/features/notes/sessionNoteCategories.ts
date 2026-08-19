import type { SessionNoteCategory } from '../../types/cohort';

const sessionNoteCategoryLabels: Record<SessionNoteCategory, string> = {
  general: 'General',
  attendance: 'Attendance',
  behaviour: 'Behaviour',
  achievement: 'Achievement',
  follow_up: 'Follow-up',
};
const sessionNoteCategories: SessionNoteCategory[] = [
  'general',
  'attendance',
  'behaviour',
  'achievement',
  'follow_up',
];

export const sessionNoteCategoryOptions: Array<{
  value: SessionNoteCategory;
  label: string;
}> = sessionNoteCategories.map(value => ({
  value,
  label: sessionNoteCategoryLabels[value],
}));

export const getSessionNoteCategoryLabel = (category: SessionNoteCategory) => (
  sessionNoteCategoryLabels[category]
);
