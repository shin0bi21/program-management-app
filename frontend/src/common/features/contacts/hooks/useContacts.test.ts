import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useContacts } from './useContacts';

describe('useContacts', () => {
  it('starts with supplied contacts or one empty contact', () => {
    const existing = [{ id: 'contact-1', phoneNumber: '519-555-0101', type: 'guardian' as const }];
    const populated = renderHook(() => useContacts(existing));
    const empty = renderHook(() => useContacts());

    expect(populated.result.current.contacts).toEqual(existing);
    expect(empty.result.current.contacts).toEqual([{
      id: '',
      phoneNumber: '',
      type: 'parent',
    }]);
  });

  it('initializes, edits, adds, deletes, and resets contact drafts', () => {
    const { result } = renderHook(() => useContacts());

    act(() => result.current.initialize([
      { id: 'contact-1', phoneNumber: null, type: '' },
    ]));
    expect(result.current.contacts).toEqual([{
      id: 'contact-1',
      phoneNumber: '',
      type: 'parent',
    }]);

    act(() => {
      result.current.handleChange(0, 'phoneNumber', '519-555-0101');
      result.current.handleChange(0, 'type', 'guardian');
      result.current.handleAdd();
    });
    expect(result.current.contacts).toEqual([
      { id: 'contact-1', phoneNumber: '519-555-0101', type: 'guardian' },
      { id: '', phoneNumber: '', type: 'parent' },
    ]);

    act(() => result.current.handleDelete(0));
    expect(result.current.contacts).toEqual([{ id: '', phoneNumber: '', type: 'parent' }]);

    act(() => result.current.reset());
    expect(result.current.contacts).toEqual([{ id: '', phoneNumber: '', type: 'parent' }]);
  });

  it('validates persisted blank contacts and emits only trimmed populated payloads', () => {
    const { result } = renderHook(() => useContacts());

    act(() => result.current.initialize([
      { id: 'contact-1', phoneNumber: '', type: 'sibling' },
      { id: '', phoneNumber: ' 226-555-0102 ', type: 'guardian' },
    ]));
    expect(result.current.validate()).toBe('Contact 1: Phone number is required');

    act(() => result.current.handleChange(0, 'phoneNumber', ' 519-555-0101 '));
    expect(result.current.validate()).toBeUndefined();
    expect(result.current.getPayload()).toEqual([
      { id: 'contact-1', phoneNumber: '519-555-0101', type: 'sibling' },
      { phoneNumber: '226-555-0102', type: 'guardian' },
    ]);
  });
});
