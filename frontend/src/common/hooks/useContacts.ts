import { useCallback, useState } from 'react';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  type: 'parent' | 'sibling' | 'guardian';
}

const EMPTY_CONTACT: Contact = { id: '', firstName: '', lastName: '', phoneNumber: '', type: 'parent' };

export function useContacts(initialContacts?: Contact[]) {
  const [contacts, setContacts] = useState<Contact[]>(
    initialContacts && initialContacts.length > 0 ? initialContacts : [{ ...EMPTY_CONTACT }]
  );

  const initialize = useCallback((incoming: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    type: string;
  }> | null | undefined) => {
    if (incoming && incoming.length > 0) {
      setContacts(incoming.map(c => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        phoneNumber: c.phoneNumber || '',
        type: (c.type as 'parent' | 'sibling' | 'guardian') || 'parent',
      })));
    } else {
      setContacts([{ ...EMPTY_CONTACT }]);
    }
  }, []);

  const reset = useCallback(() => setContacts([{ ...EMPTY_CONTACT }]), []);

  const handleAdd = () => {
    setContacts(prev => [...prev, { ...EMPTY_CONTACT }]);
  };

  const handleDelete = (index: number) => {
    setContacts(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof Contact, value: string) => {
    setContacts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Returns an error string if invalid, undefined if valid
  const validate = (): string | undefined => {
    const namePattern = /^[a-zA-Z\s'-]+$/;
    for (let i = 0; i < contacts.length; i++) {
      const cont = contacts[i];
      const hasAnyField = cont.firstName.trim() || cont.lastName.trim() || cont.phoneNumber.trim();
      if (!hasAnyField) continue;

      if (!cont.firstName.trim()) return `Contact ${i + 1}: First name is required`;
      if (!cont.lastName.trim()) return `Contact ${i + 1}: Last name is required`;
      if (!namePattern.test(cont.firstName.trim())) return `Contact ${i + 1}: First name can only contain letters, spaces, hyphens, and apostrophes`;
      if (!namePattern.test(cont.lastName.trim())) return `Contact ${i + 1}: Last name can only contain letters, spaces, hyphens, and apostrophes`;
    }
    return undefined;
  };

  // Returns filtered non-empty contacts ready for API payload
  const getPayload = () =>
    contacts
      .filter(c => c.firstName.trim() || c.lastName.trim())
      .map(c => ({
        ...(c.id && { id: c.id }),
        firstName: c.firstName.trim(),
        lastName: c.lastName.trim(),
        phoneNumber: c.phoneNumber.trim(),
        type: c.type,
      }));

  return { contacts, initialize, reset, handleAdd, handleDelete, handleChange, validate, getPayload };
}
