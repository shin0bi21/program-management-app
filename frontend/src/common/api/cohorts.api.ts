import type {
  AttendanceStatus,
  CohortSession,
  CreateCohortInput,
  CreateSessionNoteInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  GenerateSessionsResult,
  ManagedSession,
  ProgramCohort,
  SessionListFilters,
  SessionNote,
  SessionRosterMember,
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

export function syncYouthCohorts(youthId: string, cohortIds: string[]) {
  return apiClient.put(`/cohorts/enrollments/${youthId}`, { cohortIds });
}

export function generateSessions(cohortId: string, data: GenerateSessionsInput) {
  return apiClient.post<GenerateSessionsResult>(`/cohorts/${cohortId}/sessions/generate`, data);
}

export function getManagedSessions(filters: SessionListFilters = {}) {
  const query = new URLSearchParams();
  if (filters.programId) query.set('programId', filters.programId);
  if (filters.cohortId) query.set('cohortId', filters.cohortId);
  if (filters.timing) query.set('timing', filters.timing);
  if (filters.search) query.set('search', filters.search);
  return apiClient.get<ManagedSession[]>(`/cohorts/sessions?${query}`);
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

export function updateSession(sessionId: string, data: UpdateSessionInput) {
  return apiClient.put(`/cohorts/sessions/${sessionId}`, data);
}

export function deleteSession(sessionId: string) {
  return apiClient.delete(`/cohorts/sessions/${sessionId}`);
}

export function getCohortSessions(start: string, end: string) {
  const query = new URLSearchParams({ start, end });
  return apiClient.get<CohortSession[]>(`/cohorts/sessions/calendar?${query}`);
}
