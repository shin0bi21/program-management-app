import { apiClient } from '../../../../http/client';
import type { ResourcePeriodData } from '../../../../common/components/ResourceCalendar/types';
import type { StaffResource, TimeEntryCohort, TimeEntryProgram, TimeEntryTask, TimesheetItem } from '../types';

export interface TimeEntryResponse {
  id: string;
  staffId: string;
  programId: string | null;
  programName: string | null;
  cohortId: string | null;
  cohortName: string | null;
  task: TimeEntryTask;
  workDate: string;
  hours: number;
  note: string;
}

export interface SetTimeEntryInput {
  staffId: string;
  programId: string | null;
  cohortId: string | null;
  task: TimeEntryTask;
  workDate: string;
  hours: number;
  note: string;
}

export interface TimeEntryRangeResponse {
  resources: StaffResource[];
  programs: TimeEntryProgram[];
  data: ResourcePeriodData<TimesheetItem>;
}

export function getTimeEntries(start: string, end: string) {
  const params = new URLSearchParams({ start, end });
  return apiClient.get<TimeEntryRangeResponse>(`/time-entries?${params}`);
}

export function getTimeEntryCohorts(programId: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ programId });
  return apiClient.get<TimeEntryCohort[]>(`/time-entries/cohorts?${params}`, { signal });
}

export function createTimeEntry(input: SetTimeEntryInput) {
  return apiClient.post<TimeEntryResponse>('/time-entries', input);
}

export function updateTimeEntry(id: string, input: SetTimeEntryInput) {
  return apiClient.put<TimeEntryResponse>(`/time-entries/${id}`, input);
}

export function deleteTimeEntry(id: string) {
  return apiClient.delete<{ message: string }>(`/time-entries/${id}`);
}
