// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  createSession,
  moveSessionDate,
  updateSession,
  setSessionAttendance,
  createSessionAttachment,
  getSessionAttachmentDownloadName,
  getSessions,
  getSessionReferenceData,
  getAttendanceYouth,
} from './sessions.api';

vi.mock('../../../http/client', () => ({
  apiClient: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

describe('session API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads scheduling options and allowed program-cycle pairs with cancellation', async () => {
    const options = { signal: new AbortController().signal };
    const projection = { programs: [], sessionTypes: [] };
    vi.mocked(apiClient.get).mockResolvedValueOnce(projection);

    expect(await getSessionReferenceData(options)).toEqual(projection);
    expect(apiClient.get).toHaveBeenCalledWith('/sessions/reference-data', options);
  });

  it('moves a session with a date-only command', () => {
    moveSessionDate('session-1', '2027-01-12');
    expect(apiClient.put).toHaveBeenCalledWith('/sessions/session-1/date', { date: '2027-01-12' });
  });

  it('forwards canonical edit and attendance command responses to their owners', async () => {
    const saved = { id: 'session-1', theme: 'Authoritative session' };
    const edit = { sessionType: 'Regular', theme: 'Edited', startsAt: '2027-01-12T18:00:00Z', endsAt: '2027-01-12T20:00:00Z' };
    vi.mocked(apiClient.put).mockResolvedValueOnce({ session: saved });

    await expect(updateSession('session-1', edit)).resolves.toEqual({ session: saved });
    expect(apiClient.put).toHaveBeenLastCalledWith('/sessions/session-1', edit);

    const attendance = { roster: [], session: saved };
    vi.mocked(apiClient.put).mockResolvedValueOnce(attendance);
    await expect(setSessionAttendance('session-1', [])).resolves.toBe(attendance);
    expect(apiClient.put).toHaveBeenLastCalledWith('/sessions/session-1/attendance', { records: [] });
  });

  it('creates by program and date so the server resolves the assigned cycle', () => {
    const data = { programId: 'program-1', sessionType: 'Regular', theme: 'Art', date: '2026-10-27' };
    createSession(data);
    expect(apiClient.post).toHaveBeenCalledWith('/sessions', data);
  });

  it('serializes session list filters without adding a trailing question mark', () => {
    getSessions({}, undefined, { key: 'date', direction: 'asc' });

    expect(apiClient.get).toHaveBeenCalledWith(
      '/sessions?sort=date&direction=asc&limit=50',
    );
  });

  it('serializes selected cycles for both paginated and calendar requests', () => {
    const options = { signal: new AbortController().signal };
    getSessions({ cycleIds: ['cycle-1', 'cycle-2'], programIds: ['program-1'] }, options, { key: 'date', direction: 'asc' });
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/sessions?programIds=program-1&cycleIds=cycle-1%2Ccycle-2&sort=date&direction=asc&limit=50', options,
    );

    getSessions({ cycleIds: ['cycle-1', 'cycle-2'], start: '2026-07-01', end: '2026-08-01' }, options);
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/sessions?start=2026-07-01&end=2026-08-01&cycleIds=cycle-1%2Ccycle-2', options,
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
      '/sessions/session-1/attachments',
      expect.any(FormData),
    );
    const form = vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
    expect(form.get('title')).toBe('Session plan');
    expect(form.get('description')).toBe('Preparation notes');
    expect(form.get('youthIds')).toBe('["youth-1","youth-2"]');
    expect(form.get('file')).toBe(file);
  });

  it('loads all attendance youth and forwards cancellation', () => {
    const signal = new AbortController().signal;
    getAttendanceYouth({ signal });

    expect(apiClient.get).toHaveBeenCalledWith('/youth', { signal });
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
      { key: 'date', direction: 'asc', limit: 50 });
    const path = vi.mocked(apiClient.get).mock.calls[vi.mocked(apiClient.get).mock.calls.length - 1]?.[0];
    const url = new URL(String(path), 'http://localhost');
    expect(url.searchParams.get('start')).toBe('2026-03-08T05:00:00Z');
    expect(url.searchParams.get('end')).toBe('2026-03-09T04:00:00Z');
  });
});
