import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { ResourcePeriodData } from '../../components/ResourceCalendar/types';
import type { CursorPage, CursorRequest } from '../../types/pagination';
import type { StaffResource, HoursCategory, HoursProgram, HoursSession, HoursItem, HoursTableRow } from './types';

export interface HoursResponse {
  id: string;
  staffId: string;
  programId: string | null; programName: string | null;
  cycleId: string;
  cycleName: string;
  cycleStartsOn: string;
  cycleEndsOn: string;
  category: HoursCategory;
  taskId: string | null; taskTitle: string | null;
  sessionId: string | null; sessionLabel: string | null;
  workDate: string;
  hours: number;
  note: string;
}

interface SharedHoursInput { staffId: string; hours: number; note: string }
export type SetHoursInput = SharedHoursInput & ({
  source: 'regular'; workDate: string; programId: string | null; category: Exclude<HoursCategory, 'program_delivery'>;
} | { source: 'task'; workDate: string; taskId: string; completeTask?: boolean }
  | { source: 'session'; sessionId: string });
export interface UpdateHoursPlacementInput { workDate: string }

export interface HoursRangeResponse {
  resources: StaffResource[];
  programs: HoursProgram[];
  data: ResourcePeriodData<HoursItem>;
}

export interface HoursOverviewResponse {
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

export interface HoursFilters { start?: string; end?: string; cycleId?: string }

export interface HoursListFilters {
  staffIds: string[]; categories: HoursCategory[]; programIds: string[];
  types: Array<'task' | 'session' | 'other'>; cycleId?: string; search?: string;
}
export function getHours(filters: HoursFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.start && filters.end) { params.set('start', filters.start); params.set('end', filters.end); }
  if (filters.cycleId) params.set('cycleId', filters.cycleId);
  const query = params.size ? `?${params}` : '';
  return apiClient.get<HoursRangeResponse>(`/hours${query}`, opts);
}

export function getHoursOptions(opts?: RequestOptions) {
  return apiClient.get<{ resources: StaffResource[]; programs: HoursProgram[] }>('/hours/options', opts);
}

export function getHoursList(
  filters: HoursListFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest,
) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction, limit: String(pagination.limit ?? 25),
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.types.length) params.set('types', filters.types.join(','));
  if (filters.cycleId) params.set('cycleId', filters.cycleId);
  if (filters.search) params.set('search', filters.search);
  return apiClient.get<CursorPage<HoursTableRow>>(`/hours/list?${params}`, opts);
}

export function getHoursOverview(staffId: string, cycleId: string, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId, cycleId });
  return apiClient.get<HoursOverviewResponse>(`/hours/overview?${params}`, opts);
}

export function getHoursSessions(staffId: string, workDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ staffId, workDate });
  return apiClient.get<HoursSession[]>(`/hours/sessions?${params}`, { signal });
}
export function setHours(input: SetHoursInput, id?: string) {
  return id
    ? apiClient.put<HoursResponse>(`/hours/${id}`, input)
    : apiClient.post<HoursResponse>('/hours', input);
}
export function updateHoursPlacement(id: string, input: UpdateHoursPlacementInput) {
  return apiClient.patch<HoursResponse>(`/hours/${id}/placement`, input);
}
export function deleteHours(id: string) { return apiClient.delete<{ message: string }>(`/hours/${id}`); }
