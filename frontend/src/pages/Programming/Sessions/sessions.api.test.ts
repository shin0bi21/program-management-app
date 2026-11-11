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

  it('loads scheduling references with cancellation', async () => {
    const options = { signal: new AbortController().signal };
    const projection = { programs: [], sessionTypes: [] };
    vi.mocked(apiClient.get).mockResolvedValueOnce(projection);

    await getSessionReferenceData(options);
    expect(apiClient.get).toHaveBeenCalledWith('/sessions/reference-data', options);
  });

  it('moves a session with a date-only command', () => {
    moveSessionDate('session-1', '2027-01-12');
    expect(apiClient.put).toHaveBeenCalledWith('/sessions/session-1/date', { date: '2027-01-12' });
  });

  it('sends the date/time edit and attendance commands to their endpoints', () => {
    const edit = { sessionType: 'Regular', theme: 'Edited', date: '2027-01-12', startTime: '13:00', endTime: '15:00' };
    updateSession('session-1', edit);
    expect(apiClient.put).toHaveBeenLastCalledWith('/sessions/session-1', edit);

    setSessionAttendance('session-1', []);
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
      '/sessions?sort=date&direction=asc&paginate=true',
    );
  });

  it('serializes selected cycles for both paginated and calendar requests', () => {
    const options = { signal: new AbortController().signal };
    getSessions({ cycleIds: ['cycle-1', 'cycle-2'], programIds: ['program-1'] }, options, { key: 'date', direction: 'asc' });
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/sessions?programIds=program-1&cycleIds=cycle-1%2Ccycle-2&sort=date&direction=asc&paginate=true', options,
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

  it('serializes inclusive table dates without timestamp reconstruction', () => {
    getSessions({ dateRange: { start: '2026-03-08', end: '2026-03-08' } }, undefined,
      { key: 'date', direction: 'asc' });

    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/sessions?start=2026-03-08&end=2026-03-08&sort=date&direction=asc&paginate=true',
    );
  });
});
