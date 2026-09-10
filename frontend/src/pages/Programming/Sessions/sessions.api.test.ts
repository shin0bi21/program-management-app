// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  createSessionAttachment,
  getSessionAttachmentDownloadName,
  getSessions,
  searchAttendanceYouth,
} from './sessions.api';

vi.mock('../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn() },
}));

describe('session API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serializes session list filters without adding a trailing question mark', () => {
    getSessions({}, undefined, { key: 'date', direction: 'asc' });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/cohorts/sessions?sort=date&direction=asc&limit=25',
    );
  });

  it('serializes selected cycles for both paginated and calendar requests', () => {
    const options = { signal: new AbortController().signal };
    getSessions({ cycleIds: ['cycle-1', 'cycle-2'], programIds: ['program-1'] }, options, { key: 'date', direction: 'asc' });
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/cohorts/sessions?programIds=program-1&cycleIds=cycle-1%2Ccycle-2&sort=date&direction=asc&limit=25', options,
    );

    getSessions({ cycleIds: ['cycle-1', 'cycle-2'], start: '2026-07-01', end: '2026-08-01' }, options);
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/cohorts/sessions?start=2026-07-01&end=2026-08-01&cycleIds=cycle-1%2Ccycle-2', options,
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

  it('searches youth through the attendance contract', () => {
    searchAttendanceYouth('  Maya + Lee  ');

    expect(apiClient.get).toHaveBeenCalledWith('/youth?search=Maya+%2B+Lee');
  });

  it('builds safe attachment downloads from the title and MIME type', () => {
    expect(getSessionAttachmentDownloadName({
      title: 'Workshop / Photos.',
      mimeType: 'image/png',
    })).toBe('Workshop - Photos.png');
  });
});
