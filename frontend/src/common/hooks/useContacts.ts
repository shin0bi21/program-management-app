import { useCallback, useState } from 'react';

export interface Contact {
  id: string;
  phoneNumber: string;
  type: 'parent' | 'sibling' | 'guardian';
}

const EMPTY_CONTACT: Contact = { id: '', phoneNumber: '', type: 'parent' };

export function useContacts(initialContacts?: Contact[]) {
  const [contacts, setContacts] = useState<Contact[]>(
    initialContacts && initialContacts.length > 0 ? initialContacts : [{ ...EMPTY_CONTACT }]
  );

  const initialize = useCallback((incoming: Array<{
    id: string;
    phoneNumber: string | null;
    type: string;
  }> | null | undefined) => {
    if (incoming && incoming.length > 0) {
      setContacts(incoming.map(c => ({
        id: c.id,
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

  const validate = (): string | undefined => {
    for (let i = 0; i < contacts.length; i++) {
      const cont = contacts[i];
      if (!cont.phoneNumber.trim() && cont.id) {
        return `Contact ${i + 1}: Phone number is required`;
      }
    }
    return undefined;
  };

  const getPayload = () =>
    contacts
      .filter(c => c.phoneNumber.trim())
      .map(c => ({
        ...(c.id && { id: c.id }),
        phoneNumber: c.phoneNumber.trim(),
        type: c.type,
      }));

  return { contacts, initialize, reset, handleAdd, handleDelete, handleChange, validate, getPayload };
}
