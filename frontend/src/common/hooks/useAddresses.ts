import { useCallback, useState } from 'react';

export interface Address {
  id: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
}

const EMPTY_ADDRESS: Address = { id: '', address: '', city: '', province: '', postalCode: '' };

export function useAddresses(initialAddresses?: Address[]) {
  const [addresses, setAddresses] = useState<Address[]>(
    initialAddresses && initialAddresses.length > 0 ? initialAddresses : [{ ...EMPTY_ADDRESS }]
  );

  const initialize = useCallback((incoming: Array<{
    id: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    country?: string;
  }> | null | undefined) => {
    if (incoming && incoming.length > 0) {
      setAddresses(incoming.map(a => ({
        id: a.id,
        address: a.address,
        city: a.city,
        province: a.province,
        postalCode: a.postalCode,
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

  // Returns an error string if invalid, undefined if valid
  const validate = (): string | undefined => {
    for (let i = 0; i < addresses.length; i++) {
      const addr = addresses[i];
      const hasAnyField = addr.address.trim() || addr.city.trim() || addr.province.trim() || addr.postalCode.trim();
      if (!hasAnyField) continue;

      if (!addr.address.trim()) return `Address ${i + 1}: Street address is required`;
      if (!addr.city.trim()) return `Address ${i + 1}: City is required`;
      if (!addr.province.trim()) return `Address ${i + 1}: Province is required`;
      if (!addr.postalCode.trim()) return `Address ${i + 1}: Postal code is required`;
    }
    return undefined;
  };

  // Returns filtered non-empty addresses ready for API payload
  const getPayload = () =>
    addresses
      .filter(a => a.address.trim() || a.city.trim() || a.province.trim() || a.postalCode.trim())
      .map(a => ({
        ...(a.id && { id: a.id }),
        address: a.address.trim(),
        city: a.city.trim(),
        province: a.province.trim(),
        postalCode: a.postalCode.trim(),
      }));

  return { addresses, initialize, reset, handleAdd, handleDelete, handleChange, validate, getPayload };
}
