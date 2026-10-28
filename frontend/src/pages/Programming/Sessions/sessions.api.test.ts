// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  createSession,
  moveSessionDate,
  createSessionAttachment,
  getSessionAttachmentDownloadName,
  getSessions,
  searchAttendanceYouth,
} from './sessions.api';

vi.mock('../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('session API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves a session with a date-only command', () => {
    moveSessionDate('session-1', '2027-01-12');
    expect(apiClient.put).toHaveBeenCalledWith('/cohorts/sessions/session-1/date', { date: '2027-01-12' });
  });

  it('creates by program and date so the server resolves the assigned cycle', () => {
    const data = { programId: 'program-1', sessionTypeId: 'type-1', theme: 'Art', date: '2026-10-27' };
    createSession(data);
    expect(apiClient.post).toHaveBeenCalledWith('/cohorts/sessions', data);
  });

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

describe('session date-range filtering', () => {
  it('uses the same inclusive local days for table requests across DST', () => {
    getSessions({ dateRange: { start: '2026-03-08', end: '2026-03-08' } }, undefined,
      { key: 'date', direction: 'asc', limit: 25 });
    const path = vi.mocked(apiClient.get).mock.calls[vi.mocked(apiClient.get).mock.calls.length - 1]?.[0];
    const url = new URL(String(path), 'http://localhost');
    expect(url.searchParams.get('start')).toBe('2026-03-08T05:00:00Z');
    expect(url.searchParams.get('end')).toBe('2026-03-09T04:00:00Z');
  });
});
