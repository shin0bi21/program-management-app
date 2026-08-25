import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { ResourcePeriodData } from '../../../common/components/ResourceCalendar/types';
import type { CursorPage, CursorRequest } from '../../../common/types/pagination';
import type {
  HoursCategory,
  HoursEntry,
  HoursItem,
  HoursEntryType,
  HoursTableRow,
  StaffResource,
  HoursProgram,
} from './types';

interface SharedHoursInput { staffId: string; hours: number; note: string }
export type SetHoursInput = SharedHoursInput & ({
  source: 'regular'; workDate: string; programId: string | null; category: Exclude<HoursCategory, 'program_delivery'>;
} | { source: 'task'; workDate: string; taskId: string; completeTask?: boolean }
  | { source: 'session'; sessionId: string });
export interface UpdateHoursPlacementInput { workDate: string }

export type HoursCalendarData = ResourcePeriodData<HoursItem>;

export interface HoursSession {
  id: string;
  label: string;
  programId: string;
  programName: string;
  workDate: string;
  startsAt: string;
}

export interface HoursReferenceData {
  resources: StaffResource[];
  programs: HoursProgram[];
  categories: Array<{ value: HoursCategory; label: string }>;
  types: Array<{ value: HoursEntryType; label: string }>;
}

export interface HoursDashboardData {
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

export interface HoursCalendarFilters { start?: string; end?: string; cycleId?: string }

export interface HoursTableFilters {
  staffIds: string[]; categories: HoursCategory[]; programIds: string[];
  types: Array<'task' | 'session' | 'other'>; cycleId?: string; search?: string;
}
export function getHoursCalendarData(filters: HoursCalendarFilters = {}, opts?: RequestOptions) {
  const params = new URLSearchParams();
  if (filters.start && filters.end) { params.set('start', filters.start); params.set('end', filters.end); }
  if (filters.cycleId) params.set('cycleId', filters.cycleId);
  const query = params.size ? `?${params}` : '';
  return apiClient.get<HoursCalendarData>(`/hours/calendar${query}`, opts);
}

export function getHoursReferenceData(opts?: RequestOptions) {
  return apiClient.get<HoursReferenceData>('/hours/reference-data', opts);
}

export function getHoursTableData(
  filters: HoursTableFilters,
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
  return apiClient.get<CursorPage<HoursTableRow>>(`/hours/table?${params}`, opts);
}

export function getHoursDashboardData(staffId: string, cycleId: string, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId, cycleId });
  return apiClient.get<HoursDashboardData>(`/hours/dashboard?${params}`, opts);
}

export function getHoursSessions(staffId: string, workDate: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ staffId, workDate });
  return apiClient.get<HoursSession[]>(`/hours/sessions?${params}`, { signal });
}
export function setHours(input: SetHoursInput, id?: string) {
  return id
    ? apiClient.put<HoursEntry>(`/hours/${id}`, input)
    : apiClient.post<HoursEntry>('/hours', input);
}
export function updateHoursPlacement(id: string, input: UpdateHoursPlacementInput) {
  return apiClient.patch<HoursEntry>(`/hours/${id}/placement`, input);
}
export function deleteHours(id: string) { return apiClient.delete<{ message: string }>(`/hours/${id}`); }
