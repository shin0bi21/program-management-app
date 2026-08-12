import { apiClient } from '../../../../http/client';
import type { RequestOptions } from '../../../../http/client';
import type { ResourcePeriodData } from '../../../components/ResourceCalendar/types';
import type { StaffResource, TimeEntryCategory, TimeEntryProgram, TimeEntrySession, TimesheetItem } from '../types';

export interface TimeEntryResponse {
  id: string; staffId: string; programId: string | null; programName: string | null;
  cycleId: string; cycleName: string; cycleStartsOn: string; cycleEndsOn: string;
  category: TimeEntryCategory; taskId: string | null; taskTitle: string | null;
  sessionId: string | null; sessionLabel: string | null;
  workDate: string; hours: number; note: string;
}

interface SharedTimeEntryInput { staffId: string; hours: number; note: string }
export type SetTimeEntryInput = SharedTimeEntryInput & ({
  source: 'regular'; workDate: string; programId: string | null; category: Exclude<TimeEntryCategory, 'program_delivery'>;
} | { source: 'task'; workDate: string; taskId: string; completeTask?: boolean }
  | { source: 'session'; sessionId: string });
export interface UpdateTimeEntryPlacementInput { workDate: string }

export interface TimeEntryRangeResponse {
  resources: StaffResource[];
  programs: TimeEntryProgram[];
  data: ResourcePeriodData<TimesheetItem>;
}

export interface TimeEntryOverviewResponse {
  payPeriod: {
    periodStart: string;
    periodEnd: string;
    totalHours: number;
    breakdown: Array<{ label: string; hours: number }>;
  };
  biweeklyAverage: {
    periodCount: number;
    averageHours: number;
    breakdown: Array<{ label: string; hours: number }>;
  };
}

export interface TimeEntryFilters { start?: string; end?: string; cycleId?: string }

export function getTimeEntries(filters: TimeEntryFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.start && filters.end) { params.set('start', filters.start); params.set('end', filters.end); }
  if (filters.cycleId) params.set('cycleId', filters.cycleId);
  const query = params.size ? `?${params}` : '';
  return apiClient.get<TimeEntryRangeResponse>(`/time-entries${query}`, opts);
}

export function getTimeEntryOverview(staffId: string, cycleId: string, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId, cycleId });
  return apiClient.get<TimeEntryOverviewResponse>(`/time-entries/overview?${params}`, opts);
}

export function getTimeEntrySessions(staffId: string, workDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ staffId, workDate });
  return apiClient.get<TimeEntrySession[]>(`/time-entries/sessions?${params}`, { signal });
}
export function createTimeEntry(input: SetTimeEntryInput) { return apiClient.post<TimeEntryResponse>('/time-entries', input); }
export function updateTimeEntry(id: string, input: SetTimeEntryInput) { return apiClient.put<TimeEntryResponse>(`/time-entries/${id}`, input); }
export function updateTimeEntryPlacement(id: string, input: UpdateTimeEntryPlacementInput) {
  return apiClient.patch<TimeEntryResponse>(`/time-entries/${id}/placement`, input);
}
export function deleteTimeEntry(id: string) { return apiClient.delete<{ message: string }>(`/time-entries/${id}`); }
