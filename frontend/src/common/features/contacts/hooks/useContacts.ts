import { useState } from 'react';
import type { ContactDraft, ContactRelationship } from '../types';

const EMPTY_CONTACT: ContactDraft = { id: '', phoneNumber: '', type: 'parent' };

/**
 * Manages the contacts shown in a form and prepares them for saving.
 * @param contacts - Contacts to show when the form first opens. If omitted or empty, show one blank contact.
 * @returns Contacts, actions to edit them, a check for missing phone numbers, and contacts ready to save.
 * @example useContacts() // one blank parent contact
 */
export function useContacts(contacts?: Array<{
  id: string;
  phoneNumber: string | null;
  type: ContactRelationship;
}> | null) {
  const [draft, setDraft] = useState<ContactDraft[]>(() => {
    if (!contacts?.length) return [{ ...EMPTY_CONTACT }];

    return contacts.map(contact => ({
      id: contact.id,
      phoneNumber: contact.phoneNumber ?? '',
      type: contact.type,
    }));
  });

  /**
   * Adds a blank contact at the end of the form.
   * @example handleAdd() // adds another parent contact
   */
  const handleAdd = () => {
    setDraft(currentContacts => [...currentContacts, { ...EMPTY_CONTACT }]);
  };

  /**
   * Removes a contact from the form.
   * @param index - Contact position, starting at 0 for the first contact.
   * @example handleDelete(0) // removes the first contact
   */
  const handleDelete = (index: number) => {
    setDraft(currentContacts => currentContacts.filter((_, contactIndex) => contactIndex !== index));
  };

  /**
   * Changes one field on a contact in the form.
   * @param index - Contact position, starting at 0 for the first contact.
   * @param field - Contact field to change: 'id', 'phoneNumber', or 'type' (relationship).
   * @param value - New value for that field. For 'type', use 'parent', 'sibling', or 'guardian'.
   * @example handleChange(0, 'type', 'guardian') // changes the first relationship
   */
  const handleChange = (index: number, field: keyof ContactDraft, value: string) => {
    setDraft(currentContacts => {
      const updatedContacts = [...currentContacts];
      updatedContacts[index] = { ...updatedContacts[index], [field]: value };
      return updatedContacts;
    });
  };

  /**
   * Checks whether an existing contact has had its phone number cleared.
   * @returns A message identifying the first missing phone number, or undefined when valid.
   * @example validate() // 'Contact 1: Phone number is required' for a blank saved contact
   */
  const validate = (): string | undefined => {
    for (let contactIndex = 0; contactIndex < draft.length; contactIndex++) {
      const contact = draft[contactIndex];
      if (!contact.phoneNumber.trim() && contact.id) {
        return `Contact ${contactIndex + 1}: Phone number is required`;
      }
    }
    return undefined;
  };

  /**
   * Prepares contacts for saving, removing spaces around phone numbers and skipping blank entries.
   * @returns Contacts with phone numbers; existing contacts also include their saved IDs.
   * @example getPayload() // [] when the only draft is blank
   */
  const getPayload = () =>
    draft
      .filter(contact => contact.phoneNumber.trim())
      .map(contact => ({
        ...(contact.id && { id: contact.id }),
        phoneNumber: contact.phoneNumber.trim(),
        type: contact.type,
      }));

  return { draft, handleAdd, handleDelete, handleChange, validate, getPayload };
}
