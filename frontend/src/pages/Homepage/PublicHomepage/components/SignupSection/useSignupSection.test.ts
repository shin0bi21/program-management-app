import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitPublicLead } from '../../publicHomepage.api';
import { useSignupSection } from './useSignupSection';

vi.mock('../../publicHomepage.api', () => ({ submitPublicLead: vi.fn() }));

describe('useSignupSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owns the successful submission lifecycle and normalized API payload', async () => {
    vi.mocked(submitPublicLead).mockResolvedValue({ message: 'ok' });
    const { result } = renderHook(useSignupSection);

    await act(async () => result.current.onValid({
      youthFirstName: ' Jamie ',
      youthLastName: ' Test ',
      age: 14,
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
      age: 14,
      school: 'Westview',
      submittedByRole: 'guardian',
      contactPhoneNumber: '519-555-0100',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: 'Call after school.',
      website: '',
    });
    await waitFor(() => expect(result.current.submitStatus).toBe('success'));
  });
});
