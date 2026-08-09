import type { SessionNoteCategory } from '../../types/cohort';

export const sessionNoteCategoryOptions: Array<{
  value: SessionNoteCategory;
  label: string;
}> = [
  { value: 'general', label: 'General' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'behaviour', label: 'Behaviour' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'follow_up', label: 'Follow-up' },
];

export const getSessionNoteCategoryLabel = (category: SessionNoteCategory) => (
  sessionNoteCategoryOptions.find(option => option.value === category)?.label ?? 'General'
);
