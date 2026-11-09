import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitPublicLead } from '../../publicHomepage.api';
import { useSignupSection } from './useSignupSection';

vi.mock('../../publicHomepage.api', () => ({ submitPublicLead: vi.fn() }));

describe('useSignupSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owns the successful submission lifecycle and normalized API payload', async () => {
    vi.mocked(submitPublicLead).mockResolvedValue({ message: 'ok' });
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSignupSection(onSuccess));

    await act(async () => result.current.onValid({
      youthFirstName: ' Jamie ',
      youthLastName: ' Test ',
      dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
      school: ' Westview ',
      submittedByRole: 'guardian',
      contactPhoneNumber: ' 519-555-0100 ',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: ' Call after school. ',
      website: '',
    }));

    expect(submitPublicLead).toHaveBeenCalledWith({
      youthFirstName: 'Jamie',
      youthLastName: 'Test',
      dateOfBirth: `${new Date().getFullYear() - 14}-01-01`,
      school: 'Westview',
      submittedByRole: 'guardian',
      contactPhoneNumber: '519-555-0100',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: 'Call after school.',
      website: '',
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
