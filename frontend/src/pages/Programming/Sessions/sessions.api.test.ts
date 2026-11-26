// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '../../../http/client';
import {
  setSession,
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

  it('sends session saves to the same endpoint with their supplied fields', () => {
    const date = '2027-01-12';
    const fields = { sessionType: 'Regular', title: 'Workshop', date, startTime: '13:00', endTime: '15:00' };
    const create = { programId: 'program-1', ...fields };
    const edit = { id: 'session-1', ...fields };
    const move = { id: 'session-1', date };

    setSession(create);
    setSession(edit);
    setSession(move);

    expect(apiClient.post).toHaveBeenNthCalledWith(1, '/sessions', create);
    expect(apiClient.post).toHaveBeenNthCalledWith(2, '/sessions', edit);
    expect(apiClient.post).toHaveBeenNthCalledWith(3, '/sessions', move);
  });

  it('sends attendance records to the session attendance endpoint', () => {
    setSessionAttendance('session-1', []);
    expect(apiClient.put).toHaveBeenCalledWith('/sessions/session-1/attendance', { records: [] });
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
