// @vitest-environment node
// Owns session adapter list, attachment upload, and download-name contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../../http/client';
import {
  createSessionAttachment,
  getSessionAttachmentDownloadName,
  getSessions,
} from './sessions.api';

vi.mock('../../../../http/client', () => ({
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

  it('builds safe attachment downloads from the title and MIME type', () => {
    expect(getSessionAttachmentDownloadName({
      title: 'Workshop / Photos.',
      mimeType: 'image/png',
    })).toBe('Workshop - Photos.png');
  });
});
