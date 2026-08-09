import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../../../http/client';
import { getCohortPage } from './cohorts.api';
import { createSessionAttachment, getSessions } from './sessions.api';

vi.mock('../../../../http/client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

describe('programming APIs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes cohort filters and pagination', () => {
    getCohortPage(
      { programId: 'program-1', search: 'Summer + Fall', status: 'active' },
      { key: 'start', direction: 'desc', limit: 10, cursor: 'cursor-1' },
    );

    expect(apiClient.get).toHaveBeenCalledWith(
      '/cohorts?programId=program-1&search=Summer+%2B+Fall&status=active&sort=start&direction=desc&limit=10&cursor=cursor-1',
    );
  });

  it('serializes session list filters without adding a trailing question mark', () => {
    getSessions({}, undefined, { key: 'date', direction: 'asc' });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/cohorts/sessions?sort=date&direction=asc&limit=25',
    );
  });

  it('creates multipart session attachments', () => {
    const file = new File(['contents'], 'plan.pdf', { type: 'application/pdf' });
    createSessionAttachment('session-1', {
      title: 'Session plan',
      description: 'Preparation notes',
      youthIds: ['youth-1', 'youth-2'],
      file,
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/cohorts/sessions/session-1/attachments',
      expect.any(FormData),
    );
    const form = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(form.get('title')).toBe('Session plan');
    expect(form.get('description')).toBe('Preparation notes');
    expect(form.get('youthIds')).toBe('["youth-1","youth-2"]');
    expect(form.get('file')).toBe(file);
  });
});
