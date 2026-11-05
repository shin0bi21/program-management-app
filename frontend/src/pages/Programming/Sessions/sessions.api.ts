import type { YouthProfile } from '../../Youth/types';
import type { ProgramCycleAssignment } from '../Programs/types';
import type { Program } from '../../../common/features/programs/types';
import { getSessionRequestRange } from './utils/sessionDateRange';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { AttendanceStatus } from '../../../common/features/AttendanceStatusSelect/types';
import type {
  ProgramSession,
  SessionAttachment,
  SessionListFilters,
  SessionNote,
  SessionRosterMember,
  SessionSortKey,
  SessionType,
} from './types';
import { TABLE_PAGE_SIZE, type CursorPage, type CursorRequest } from '../../../query/types';

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

export interface AttendanceYouth {
  id: string;
  firstName: string;
  lastName: string;
}

export function getAttendanceYouth(opts?: RequestOptions) {
  return opts
    ? apiClient.get<AttendanceYouth[]>('/youth', opts)
    : apiClient.get<AttendanceYouth[]>('/youth');
}

export interface CreateSessionInput {
  programId: string;
  sessionTypeId: string;
  theme: string;
  date?: string;
  startTime?: string;
  endTime?: string;
}

export type CreatedSessionResult = ProgramSession & { updatedProgramCycles?: ProgramCycleAssignment[] };

export interface UpdatedSessionResult {
  session: ProgramSession;
  updatedProgramCycles?: ProgramCycleAssignment[];
}

export interface DeletedSessionResult {
  id: string;
  updatedProgramCycles?: ProgramCycleAssignment[];
}

export function createSession(data: CreateSessionInput) {
  return apiClient.post<CreatedSessionResult>('/sessions', data);
}


export function getSessionTypes(opts?: RequestOptions) {
  return opts
    ? apiClient.get<SessionType[]>('/session-types', opts)
    : apiClient.get<SessionType[]>('/session-types');
}

export function getSessions(filters: SessionCalendarFilters, opts?: RequestOptions): Promise<ProgramSession[]>;
export function getSessions(
  filters: SessionListFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest<SessionSortKey>,
): Promise<CursorPage<ProgramSession>>;
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
    query.set('limit', String(pagination.limit ?? TABLE_PAGE_SIZE));
    if (pagination.cursor) query.set('cursor', pagination.cursor);
  }
  const suffix = query.toString();
  const path = `/sessions${suffix ? `?${suffix}` : ''}`;
  return opts
    ? apiClient.get<ProgramSession[] | CursorPage<ProgramSession>>(path, opts)
    : apiClient.get<ProgramSession[] | CursorPage<ProgramSession>>(path);
}

export function getSessionRoster(sessionId: string, opts?: RequestOptions) {
  const path = `/sessions/${sessionId}/roster`;
  return opts
    ? apiClient.get<SessionRosterMember[]>(path, opts)
    : apiClient.get<SessionRosterMember[]>(path);
}

export interface SessionAttendanceResult {
  roster: SessionRosterMember[];
  session: ProgramSession;
  updatedYouth?: YouthProfile[];
  updatedProgramCycle?: ProgramCycleAssignment;
}

export function setSessionAttendance(
  sessionId: string,
  records: Array<{ youthId: string; status: AttendanceStatus; notes?: string | null }>,
) {
  return apiClient.put<SessionAttendanceResult>(`/sessions/${sessionId}/attendance`, { records });
}

export function getSessionNotes(sessionId: string, opts?: RequestOptions) {
  const path = `/sessions/${sessionId}/notes`;
  return opts ? apiClient.get<SessionNote[]>(path, opts) : apiClient.get<SessionNote[]>(path);
}

export function createSessionNote(sessionId: string, data: CreateSessionNoteInput) {
  return apiClient.post<SessionNote>(`/sessions/${sessionId}/notes`, data);
}

export function updateSessionNote(sessionId: string, noteId: string, data: UpdateSessionNoteInput) {
  return apiClient.put<SessionNote>(`/sessions/${sessionId}/notes/${noteId}`, data);
}

export function deleteSessionNote(sessionId: string, noteId: string) {
  return apiClient.delete(`/sessions/${sessionId}/notes/${noteId}`);
}

export function unlinkSessionNoteYouth(sessionId: string, noteId: string, youthId: string) {
  return apiClient.delete(`/sessions/${sessionId}/notes/${noteId}/youth/${youthId}`);
}

export function getSessionAttachments(sessionId: string, opts?: RequestOptions) {
  const path = `/sessions/${sessionId}/attachments`;
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
  return apiClient.post<SessionAttachment>(`/sessions/${sessionId}/attachments`, form);
}

export function deleteSessionAttachment(sessionId: string, attachmentId: string) {
  return apiClient.delete(`/sessions/${sessionId}/attachments/${attachmentId}`);
}

export function updateSessionAttachment(
  sessionId: string,
  attachmentId: string,
  data: UpdateSessionAttachmentInput,
) {
  return apiClient.put<SessionAttachment>(
    `/sessions/${sessionId}/attachments/${attachmentId}`,
    data,
  );
}

export function getSessionAttachmentFile(
  sessionId: string,
  attachmentId: string,
  opts?: RequestOptions,
) {
  return apiClient.download(
    `/sessions/${sessionId}/attachments/${attachmentId}/file`,
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
  return apiClient.put<UpdatedSessionResult>(`/sessions/${sessionId}`, data);
}

export function moveSessionDate(sessionId: string, date: string) {
  return apiClient.put<UpdatedSessionResult>(`/sessions/${sessionId}/date`, { date });
}

export function deleteSession(sessionId: string) {
  return apiClient.delete<DeletedSessionResult>(`/sessions/${sessionId}`);
}

export interface SessionReferenceData {
  programs: Program[];
  sessionTypes: SessionType[];
}

export function getSessionReferenceData(opts?: RequestOptions) {
  return apiClient.get<SessionReferenceData>('/sessions/reference-data', opts);
}
