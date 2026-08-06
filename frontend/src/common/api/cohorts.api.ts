import type {
  AttendanceStatus,
  CohortSession,
  CreateCohortInput,
  CreateSessionNoteInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  GenerateSessionsResult,
  ProgramCohort,
  SessionCalendarFilters,
  SessionAttachment,
  SessionListFilters,
  SessionNote,
  SessionRosterMember,
  SessionType,
  UpdateCohortInput,
  UpdateSessionNoteInput,
  UpdateSessionInput,
} from '../types/cohort';
import { apiClient } from './http/client';

export function getCohorts(
  programId?: string,
  { includeAllPrograms = false }: { includeAllPrograms?: boolean } = {},
) {
  const query = new URLSearchParams();
  if (programId) query.set('programId', programId);
  if (includeAllPrograms) query.set('scope', 'all');
  const suffix = query.toString();
  return apiClient.get<ProgramCohort[]>(`/cohorts${suffix ? `?${suffix}` : ''}`);
}

export function createCohort(data: CreateCohortInput) {
  return apiClient.post<ProgramCohort>('/cohorts', data);
}

export function updateCohort(cohortId: string, data: UpdateCohortInput) {
  return apiClient.put(`/cohorts/${cohortId}`, data);
}

export function deleteCohort(cohortId: string) {
  return apiClient.delete(`/cohorts/${cohortId}`);
}

export function enrollYouth(cohortId: string, data: EnrollYouthInput) {
  return apiClient.post(`/cohorts/${cohortId}/enrollments`, data);
}

export function withdrawYouth(cohortId: string, youthId: string) {
  return apiClient.patch(`/cohorts/${cohortId}/enrollments/${youthId}/withdraw`);
}

export function generateSessions(cohortId: string, data: GenerateSessionsInput) {
  return apiClient.post<GenerateSessionsResult>(`/cohorts/${cohortId}/sessions/generate`, data);
}

export function getSessionTypes() {
  return apiClient.get<SessionType[]>('/cohorts/session-types');
}

export function getSessions(filters: SessionListFilters | SessionCalendarFilters = {}) {
  const query = new URLSearchParams();
  if ('start' in filters) query.set('start', filters.start);
  if ('end' in filters) query.set('end', filters.end);
  if (filters.programIds?.length) query.set('programIds', filters.programIds.join(','));
  if (filters.cohortId) query.set('cohortId', filters.cohortId);
  if (filters.sessionTypeIds?.length) query.set('sessionTypeIds', filters.sessionTypeIds.join(','));
  if (filters.statuses?.length) query.set('statuses', filters.statuses.join(','));
  if (filters.search) query.set('search', filters.search);
  return apiClient.get<CohortSession[]>(`/cohorts/sessions?${query}`);
}

export function getSessionRoster(sessionId: string) {
  return apiClient.get<SessionRosterMember[]>(`/cohorts/sessions/${sessionId}/roster`);
}

export function saveSessionAttendance(
  sessionId: string,
  records: Array<{ youthId: string; status: AttendanceStatus; notes?: string | null }>,
) {
  return apiClient.put<SessionRosterMember[]>(`/cohorts/sessions/${sessionId}/attendance`, { records });
}

export function getSessionNotes(sessionId: string) {
  return apiClient.get<SessionNote[]>(`/cohorts/sessions/${sessionId}/notes`);
}

export function createSessionNote(sessionId: string, data: CreateSessionNoteInput) {
  return apiClient.post<SessionNote>(`/cohorts/sessions/${sessionId}/notes`, data);
}

export function updateSessionNote(
  sessionId: string,
  noteId: string,
  data: UpdateSessionNoteInput,
) {
  return apiClient.put<SessionNote>(`/cohorts/sessions/${sessionId}/notes/${noteId}`, data);
}

export function deleteSessionNote(sessionId: string, noteId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}/notes/${noteId}`);
}

export function getSessionAttachments(sessionId: string) {
  return apiClient.get<SessionAttachment[]>(`/cohorts/sessions/${sessionId}/attachments`);
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

export async function downloadSessionAttachment(sessionId: string, attachment: SessionAttachment) {
  const blob = await apiClient.download(`/cohorts/sessions/${sessionId}/attachments/${attachment.id}/file`);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = attachment.originalFilename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function updateSession(sessionId: string, data: UpdateSessionInput) {
  return apiClient.put(`/cohorts/sessions/${sessionId}`, data);
}

export function deleteSession(sessionId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}`);
}
