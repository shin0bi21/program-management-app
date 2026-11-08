export type ContactRelationship = 'parent' | 'sibling' | 'guardian';

/** A contact being edited in a form; new contacts have an empty ID. */
export interface ContactDraft {
  id: string;
  phoneNumber: string;
  type: ContactRelationship;
}
