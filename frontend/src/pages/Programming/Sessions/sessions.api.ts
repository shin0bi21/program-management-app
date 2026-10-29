import type { Program } from '../../../common/features/programs/types';
import { getSessionRequestRange } from './utils/sessionDateRange';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { AttendanceStatus } from '../../../common/features/AttendanceStatusSelect/types';
import type {
  AttendanceYouth,
  CohortSession,
  SessionAttachment,
  SessionListFilters,
  SessionNote,
  SessionRosterMember,
  SessionSortKey,
  SessionType,
} from './types';
import type { CursorPage, CursorRequest } from '../../../query/types';

interface SessionCalendarFilters extends SessionListFilters {
  start: string;
  end: string;
}

interface CreateSessionNoteInput {
  category: SessionNote['category'];
  details: string;
  youthIds: string[];
}

type UpdateSessionNoteInput = CreateSessionNoteInput;

interface UpdateSessionAttachmentInput {
  title: string;
  description: string | null;
  youthIds: string[];
}

interface UpdateSessionInput {
  sessionTypeId: string;
  theme: string;
  startsAt: string;
  endsAt: string;
  description?: string | null;
}

export function searchAttendanceYouth(search: string, opts?: RequestOptions) {
  const query = new URLSearchParams({ search: search.trim() });
  const path = `/youth?${query}`;
  return opts
    ? apiClient.get<AttendanceYouth[]>(path, opts)
    : apiClient.get<AttendanceYouth[]>(path);
}

export interface CreateSessionInput {
  programId: string;
  sessionTypeId: string;
  theme: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export function createSession(data: CreateSessionInput) {
  return apiClient.post('/cohorts/sessions', data);
}


export function getSessionTypes(opts?: RequestOptions) {
  return opts
    ? apiClient.get<SessionType[]>('/cohorts/session-types', opts)
    : apiClient.get<SessionType[]>('/cohorts/session-types');
}

export function getSessions(filters: SessionCalendarFilters, opts?: RequestOptions): Promise<CohortSession[]>;
export function getSessions(
  filters: SessionListFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest<SessionSortKey>,
): Promise<CursorPage<CohortSession>>;
export function getSessions(
  filters: SessionListFilters | SessionCalendarFilters = {},
  opts?: RequestOptions,
  pagination?: CursorRequest<SessionSortKey>,
) {
  const query = new URLSearchParams();
  if (pagination && filters.dateRange) {
    const range = getSessionRequestRange(filters.dateRange.start, filters.dateRange.end);
    query.set('start', range.start);
    query.set('end', range.end);
  }
  if ('start' in filters) query.set('start', filters.start);
  if ('end' in filters) query.set('end', filters.end);
  if (filters.programIds?.length) query.set('programIds', filters.programIds.join(','));
  if (filters.cycleIds?.length) query.set('cycleIds', filters.cycleIds.join(','));
  if (filters.sessionTypeIds?.length) query.set('sessionTypeIds', filters.sessionTypeIds.join(','));
  if (filters.statuses?.length) query.set('statuses', filters.statuses.join(','));
  if (filters.search) query.set('search', filters.search);
  if (pagination) {
    query.set('sort', pagination.key);
    query.set('direction', pagination.direction);
    query.set('limit', String(pagination.limit ?? 25));
    if (pagination.cursor) query.set('cursor', pagination.cursor);
  }
  const suffix = query.toString();
  const path = `/cohorts/sessions${suffix ? `?${suffix}` : ''}`;
  return opts
    ? apiClient.get<CohortSession[] | CursorPage<CohortSession>>(path, opts)
    : apiClient.get<CohortSession[] | CursorPage<CohortSession>>(path);
}

export function getSessionRoster(sessionId: string, opts?: RequestOptions) {
  const path = `/cohorts/sessions/${sessionId}/roster`;
  return opts
    ? apiClient.get<SessionRosterMember[]>(path, opts)
    : apiClient.get<SessionRosterMember[]>(path);
}

export function setSessionAttendance(
  sessionId: string,
  records: Array<{ youthId: string; status: AttendanceStatus; notes?: string | null }>,
) {
  return apiClient.put<SessionRosterMember[]>(`/cohorts/sessions/${sessionId}/attendance`, { records });
}

export function getSessionNotes(sessionId: string, opts?: RequestOptions) {
  const path = `/cohorts/sessions/${sessionId}/notes`;
  return opts ? apiClient.get<SessionNote[]>(path, opts) : apiClient.get<SessionNote[]>(path);
}

export function createSessionNote(sessionId: string, data: CreateSessionNoteInput) {
  return apiClient.post<SessionNote>(`/cohorts/sessions/${sessionId}/notes`, data);
}

export function updateSessionNote(sessionId: string, noteId: string, data: UpdateSessionNoteInput) {
  return apiClient.put<SessionNote>(`/cohorts/sessions/${sessionId}/notes/${noteId}`, data);
}

export function deleteSessionNote(sessionId: string, noteId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}/notes/${noteId}`);
}

export function unlinkSessionNoteYouth(sessionId: string, noteId: string, youthId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}/notes/${noteId}/youth/${youthId}`);
}

export function getSessionAttachments(sessionId: string, opts?: RequestOptions) {
  const path = `/cohorts/sessions/${sessionId}/attachments`;
  return opts
    ? apiClient.get<SessionAttachment[]>(path, opts)
    : apiClient.get<SessionAttachment[]>(path);
}

export function createSessionAttachment(sessionId: string, data: {
  title: string;
  description: string | null;
  youthIds: string[];
  file: File;
}) {
  const form = new FormData();
  form.set('title', data.title);
  if (data.description) form.set('description', data.description);
  form.set('youthIds', JSON.stringify(data.youthIds));
  form.set('file', data.file);
  return apiClient.post<SessionAttachment>(`/cohorts/sessions/${sessionId}/attachments`, form);
}

export function deleteSessionAttachment(sessionId: string, attachmentId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}/attachments/${attachmentId}`);
}

export function updateSessionAttachment(
  sessionId: string,
  attachmentId: string,
  data: UpdateSessionAttachmentInput,
) {
  return apiClient.put<SessionAttachment>(
    `/cohorts/sessions/${sessionId}/attachments/${attachmentId}`,
    data,
  );
}

export function getSessionAttachmentFile(
  sessionId: string,
  attachmentId: string,
  opts?: RequestOptions,
) {
  return apiClient.download(
    `/cohorts/sessions/${sessionId}/attachments/${attachmentId}/file`,
    opts,
  );
}

const attachmentExtensions: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'text/plain': '.txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

export const getSessionAttachmentDownloadName = (
  attachment: Pick<SessionAttachment, 'title' | 'mimeType'>,
) => (
  `${attachment.title
    .split('')
    .map(character => character.charCodeAt(0) < 32 ? '-' : character)
    .join('')
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/[. ]+$/g, '')
    .trim() || 'attachment'}${attachmentExtensions[attachment.mimeType] ?? ''}`
);

export async function downloadSessionAttachment(sessionId: string, attachment: SessionAttachment) {
  const blob = await getSessionAttachmentFile(sessionId, attachment.id);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = getSessionAttachmentDownloadName(attachment);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function updateSession(sessionId: string, data: UpdateSessionInput) {
  return apiClient.put(`/cohorts/sessions/${sessionId}`, data);
}

export interface MoveSessionResult {
  id: string;
  cohortId: string;
  cohortName: string;
  cycleId: string;
  startsAt: string;
  endsAt: string;
}

export function moveSessionDate(sessionId: string, date: string) {
  return apiClient.put<MoveSessionResult>(`/cohorts/sessions/${sessionId}/date`, { date });
}

export function deleteSession(sessionId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}`);
}

export interface SessionReferenceData {
  programs: Program[];
  sessionTypes: SessionType[];
}

export function getSessionReferenceData(opts?: RequestOptions) {
  return apiClient.get<SessionReferenceData>('/cohorts/sessions/reference-data', opts);
}
