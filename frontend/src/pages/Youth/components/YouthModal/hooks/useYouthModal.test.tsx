import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeYouthProfile } from '../../../../../tests/factories/youth';
import { setYouth, setYouthContacts } from '../../../youth.api';
import { useYouthModal } from './useYouthModal';

const subEntities = vi.hoisted(() => ({
  validateContacts: vi.fn<() => string | undefined>(),
  getContactPayload: vi.fn(() => [{ phoneNumber: '4165550100', type: 'parent' as const }]),
}));

vi.mock('../../../youth.api', () => ({ setYouth: vi.fn(), setYouthContacts: vi.fn() }));
vi.mock('../../../../../common/features/SchoolModal/hooks/useSchools', () => ({
  useSchools: () => ({
    schools: [],
    upsertSchool: vi.fn(),
    removeSchool: vi.fn(),
    loading: false,
    error: null,
  }),
}));
vi.mock('../../../../../common/features/contacts/hooks/useContacts', () => ({
  useContacts: () => ({
    contacts: [],
    handleChange: vi.fn(),
    validate: subEntities.validateContacts,
    getPayload: subEntities.getContactPayload,
  }),
}));

const formData = {
  firstName: ' Jamie ',
  lastName: ' Test ',
  email: ' youth@example.com ',
  dateOfBirth: '2012-08-19',
  schoolId: 'school-1',
  addresses: [{ address: '123 Main Street' }],
};

describe('useYouthModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subEntities.validateContacts.mockReturnValue(undefined);
    vi.mocked(setYouth).mockResolvedValue(makeYouthProfile());
  });

  it('builds the narrow create payload and immediately reconciles the saved youth', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useYouthModal({
      inviteYouth: true,
      onClose: vi.fn(),
      onSuccess,
    }));

    await act(async () => result.current.onValid(formData));

    expect(setYouth).toHaveBeenCalledWith({
      firstName: 'Jamie',
      lastName: 'Test',
      email: 'youth@example.com',
      dateOfBirth: '2012-08-19',
      schoolId: 'school-1',
      addresses: [{ address: '123 Main Street' }],
      contacts: [{ phoneNumber: '4165550100', type: 'parent' }],
    });
    expect(result.current.submitStatus).toBe('success');
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'youth-1' }));
  });

  it.each([undefined, null, '2012-08-19'])('saves blank DOB as null for a profile with DOB %s', async dateOfBirth => {
    const youthData = dateOfBirth === undefined ? undefined : makeYouthProfile({ dateOfBirth });
    const { result } = renderHook(() => useYouthModal({
      youthData, onClose: vi.fn(), onSuccess: vi.fn(),
    }));

    await act(async () => result.current.onValid({ ...formData, dateOfBirth: '' }));

    expect(setYouth).toHaveBeenCalledWith(expect.objectContaining({
      ...(youthData && { id: youthData.id }),
      dateOfBirth: null,
    }));
    expect(result.current.submitStatus).toBe('success');
  });

  it('saves legacy contacts without validating or writing other profile fields', async () => {
    const legacy = makeYouthProfile({ dateOfBirth: null, addresses: [{ id: 'address-1', address: '' }] });
    const saved = makeYouthProfile({ firstName: 'Authoritative', dateOfBirth: null });
    vi.mocked(setYouthContacts).mockResolvedValue(saved);
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useYouthModal({
      youthData: legacy, mode: 'contact', onClose: vi.fn(), onSuccess,
    }));

    await act(async () => result.current.rhfHandleSubmit(result.current.onValid)());

    expect(setYouth).not.toHaveBeenCalled();
    expect(setYouthContacts).toHaveBeenCalledWith(legacy.id, [{ phoneNumber: '4165550100', type: 'parent' }]);
    expect(onSuccess).toHaveBeenCalledWith(saved);
    expect(result.current.submitStatus).toBe('success');
  });

  it('stops before the API when nested profile data is invalid', async () => {
    subEntities.validateContacts.mockReturnValue('Contact is invalid');
    const { result } = renderHook(() => useYouthModal({
      onClose: vi.fn(),
      onSuccess: vi.fn(),
    }));

    await act(async () => result.current.onValid(formData));

    expect(setYouth).not.toHaveBeenCalled();
    expect(result.current.submitStatus).toBe('error');
    expect(result.current.error).toBe('Contact is invalid');
  });

});
