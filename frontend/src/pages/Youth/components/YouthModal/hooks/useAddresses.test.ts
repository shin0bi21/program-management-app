import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAddresses } from './useAddresses';

describe('useAddresses', () => {
  it('starts with supplied addresses or one empty address', () => {
    const existing = [{ id: 'address-1', address: '123 Main Street' }];
    const populated = renderHook(() => useAddresses(existing));
    const empty = renderHook(() => useAddresses());

    expect(populated.result.current.addresses).toEqual(existing);
    expect(empty.result.current.addresses).toEqual([{ id: '', address: '' }]);
  });

  it('initializes, edits, adds, deletes, and resets address drafts', () => {
    const { result } = renderHook(() => useAddresses());

    act(() => result.current.initialize([{ id: 'address-1', address: '123 Main Street' }]));
    act(() => {
      result.current.handleChange(0, 'address', '456 Queen Street');
      result.current.handleAdd();
    });
    expect(result.current.addresses).toEqual([
      { id: 'address-1', address: '456 Queen Street' },
      { id: '', address: '' },
    ]);

    act(() => result.current.handleDelete(0));
    expect(result.current.addresses).toEqual([{ id: '', address: '' }]);

    act(() => result.current.initialize(null));
    expect(result.current.addresses).toEqual([{ id: '', address: '' }]);

    act(() => result.current.reset());
    expect(result.current.addresses).toEqual([{ id: '', address: '' }]);
  });

  it('validates persisted blank addresses and emits only trimmed populated payloads', () => {
    const { result } = renderHook(() => useAddresses());

    act(() => result.current.initialize([
      { id: 'address-1', address: '' },
      { id: '', address: ' 789 King Street ' },
    ]));
    expect(result.current.validate()).toBe('Address 1: Street address is required');

    act(() => result.current.handleChange(0, 'address', ' 123 Main Street '));
    expect(result.current.validate()).toBeUndefined();
    expect(result.current.getPayload()).toEqual([
      { id: 'address-1', address: '123 Main Street' },
      { address: '789 King Street' },
    ]);
  });
});
