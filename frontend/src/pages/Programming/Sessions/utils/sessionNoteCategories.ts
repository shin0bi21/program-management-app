import type { SessionNoteCategory } from '../types';

const sessionNoteCategoryLabels: Record<SessionNoteCategory, string> = {
  general: 'General',
  attendance: 'Attendance',
  behaviour: 'Behaviour',
  achievement: 'Achievement',
};
const sessionNoteCategories: SessionNoteCategory[] = [
  'general',
  'attendance',
  'behaviour',
  'achievement',
];

export const sessionNoteCategoryOptions: Array<{
  id: SessionNoteCategory;
  name: string;
}> = sessionNoteCategories.map(value => ({
  id: value,
  name: sessionNoteCategoryLabels[value],
}));

export const getSessionNoteCategoryLabel = (category: SessionNoteCategory) => (
  sessionNoteCategoryLabels[category]
);
