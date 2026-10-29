import { intersectDateRanges } from '../../../common/utils/dateRange';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { RowPeriodData } from '../../../common/components/TimelineCalendar/types';
import type { CursorPage, CursorRequest } from '../../../query/types';
import type { Task } from '../Tasks/types';
import type {
  HoursCategory,
  HoursEntry,
  HoursFilters,
  HoursItem,
  HoursEntryType,
  HoursTableRow,
} from './types';

interface SharedHoursInput { staffId: string; hours: number; note: string }
export type SetHoursInput = SharedHoursInput & ({
  source: 'regular'; workDate: string; programId: string | null; category: Exclude<HoursCategory, 'program_delivery'>;
} | { source: 'task'; workDate: string; taskId: string; completeTask?: boolean }
  | { source: 'session'; sessionId: string });
export interface UpdateHoursPlacementInput { workDate: string }
export type SetHoursResult = HoursEntry & { updatedTask?: Task };

export type HoursCalendarData = RowPeriodData<HoursItem>;

export interface HoursSession {
  id: string;
  label: string;
  programId: string;
  programName: string;
  workDate: string;
  startsAt: string;
}

export interface HoursReferenceData {
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

export function getHoursCalendarData(
  filters: HoursFilters,
  range: { start: string; end: string },
  opts?: RequestOptions,
) {
  const requestedRange = intersectDateRanges(range, filters.dateRange);
  if (!requestedRange) return Promise.resolve<HoursCalendarData>({});

  const params = new URLSearchParams({ ...requestedRange });
  applyHoursFilters(params, filters);
  return apiClient.get<HoursCalendarData>(`/hours/calendar?${params}`, opts);
}

export function getHoursReferenceData(opts?: RequestOptions) {
  return apiClient.get<HoursReferenceData>('/hours/reference-data', opts);
}

export function getHoursTableData(
  filters: HoursFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest,
) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction, limit: String(pagination.limit ?? 25),
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  applyHoursFilters(params, filters);
  if (filters.dateRange) {
    params.set('start', filters.dateRange.start);
    params.set('end', filters.dateRange.end);
  }
  return apiClient.get<CursorPage<HoursTableRow>>(`/hours/table?${params}`, opts);
}

function applyHoursFilters(params: URLSearchParams, filters: HoursFilters) {
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.types.length) params.set('types', filters.types.join(','));
  if (filters.cycleIds?.length) params.set('cycleIds', filters.cycleIds.join(','));
  if (filters.search) params.set('search', filters.search);
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
    ? apiClient.put<SetHoursResult>(`/hours/${id}`, input)
    : apiClient.post<SetHoursResult>('/hours', input);
}
export function updateHoursPlacement(id: string, input: UpdateHoursPlacementInput) {
  return apiClient.patch<HoursEntry>(`/hours/${id}/placement`, input);
}
export function deleteHours(id: string) { return apiClient.delete<{ message: string }>(`/hours/${id}`); }
