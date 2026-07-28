import { useCallback, useState } from 'react';

export interface Address {
  id: string;
  address: string;
}

const EMPTY_ADDRESS: Address = { id: '', address: '' };

export function useAddresses(initialAddresses?: Address[]) {
  const [addresses, setAddresses] = useState<Address[]>(
    initialAddresses && initialAddresses.length > 0 ? initialAddresses : [{ ...EMPTY_ADDRESS }]
  );

  const initialize = useCallback((incoming: Array<{
    id: string;
    address: string;
  }> | null | undefined) => {
    if (incoming && incoming.length > 0) {
      setAddresses(incoming.map(a => ({
        id: a.id,
        address: a.address,
      })));
    } else {
      setAddresses([{ ...EMPTY_ADDRESS }]);
    }
  }, []);

  const reset = useCallback(() => setAddresses([{ ...EMPTY_ADDRESS }]), []);

  const handleAdd = () => {
    setAddresses(prev => [...prev, { ...EMPTY_ADDRESS }]);
  };

  const handleDelete = (index: number) => {
    setAddresses(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, field: keyof Address, value: string) => {
    setAddresses(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validate = (): string | undefined => {
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      if (!addr.address.trim() && addr.id) {
        return `Address ${i + 1}: Street address is required`;
      }
    }
    return undefined;
  };

  const getPayload = () =>
    addresses
      .filter(a => a.address.trim())
      .map(a => ({
        ...(a.id && { id: a.id }),
        address: a.address.trim(),
      }));

  return { addresses, initialize, reset, handleAdd, handleDelete, handleChange, validate, getPayload };
}
