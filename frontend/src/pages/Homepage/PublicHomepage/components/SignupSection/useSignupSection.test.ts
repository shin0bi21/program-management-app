import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitExpressionOfInterest } from '../../publicHomepage.api';
import { useSignupSection } from './useSignupSection';

vi.mock('../../publicHomepage.api', () => ({ submitExpressionOfInterest: vi.fn() }));

describe('useSignupSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('owns the successful submission lifecycle and normalized API payload', async () => {
    vi.mocked(submitExpressionOfInterest).mockResolvedValue({ message: 'ok' });
    const { result } = renderHook(useSignupSection);

    await act(async () => result.current.onValid({
      youthFirstName: ' Jamie ',
      youthLastName: ' Test ',
      age: 14,
      school: ' Westview ',
      submittedByRole: 'youth',
      contactPhoneNumber: ' 519-555-0100 ',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: ' Call after school. ',
    }));

    expect(submitExpressionOfInterest).toHaveBeenCalledWith({
      youthFirstName: 'Jamie',
      youthLastName: 'Test',
      age: 14,
      school: 'Westview',
      submittedByRole: 'youth',
      contactPhoneNumber: '519-555-0100',
      contactRelationship: 'guardian',
      discoverySource: 'online',
      notes: 'Call after school.',
    });
    await waitFor(() => expect(result.current.submitStatus).toBe('success'));
  });
});
