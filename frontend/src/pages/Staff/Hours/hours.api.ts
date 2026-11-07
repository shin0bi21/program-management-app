import { intersectDateRanges } from '../../../common/utils/dateRange';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import { TABLE_PAGE_SIZE, type CursorPage, type CursorRequest } from '../../../query/types';
import type { Task } from '../Tasks/types';
import type {
  HoursCategory,
  HoursItem,
  HoursFilters,
  HoursItemType,
} from './types';

interface SharedHoursInput { staffId: string; hours: number; note: string }
export type SetHoursInput = SharedHoursInput & ({
  source: 'regular'; date: string; programId: string | null; category: Exclude<HoursCategory, 'program_delivery'>;
} | { source: 'task'; date: string; taskId: string; completeTask?: boolean }
  | { source: 'session'; sessionId: string });
export interface UpdateHoursPlacementInput { date: string }
export type HoursMutationResult = HoursItem & { updatedTasks?: Task[] };
export type SetHoursResult = HoursMutationResult;
export interface DeleteHoursResult { message: string; updatedTasks?: Task[] }

export type HoursCalendarData = HoursItem[];

export interface HoursSession {
  id: string;
  label: string;
  programId: string;
  program: string;
  date: string;
  startsAt: string;
}

export interface HoursReferenceData {
  categories: Array<{ value: HoursCategory; label: string }>;
  types: Array<{ value: HoursItemType; label: string }>;
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

/**
 * Loads Hours entries within the visible and applied date ranges.
 * @example getHoursCalendarData(filters, range, { signal })
 */
export function getHoursCalendarData(
  filters: HoursFilters,
  range: { start: string; end: string },
  opts?: RequestOptions,
) {
  const requestedRange = intersectDateRanges(range, filters.dateRange);
  if (!requestedRange) return Promise.resolve<HoursCalendarData>([]);

  const params = new URLSearchParams({ ...requestedRange });
  applyHoursFilters(params, filters);
  return apiClient.get<HoursCalendarData>(`/hours/calendar?${params}`, opts);
}

/**
 * Loads supported Hours categories and source types.
 * @example getHoursReferenceData({ signal })
 */
export function getHoursReferenceData(opts?: RequestOptions) {
  return apiClient.get<HoursReferenceData>('/hours/reference-data', opts);
}

/**
 * Loads one filtered, sorted Hours page.
 * @example getHoursTableData(filters, { signal }, pagination)
 */
export function getHoursTableData(
  filters: HoursFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest,
) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction, limit: String(pagination.limit ?? TABLE_PAGE_SIZE),
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  applyHoursFilters(params, filters);
  if (filters.dateRange) {
    params.set('start', filters.dateRange.start);
    params.set('end', filters.dateRange.end);
  }
  return apiClient.get<CursorPage<HoursItem>>(`/hours/table?${params}`, opts);
}

/**
 * Adds selected Hours filters to the request parameters.
 * @example applyHoursFilters(params, filters) // empty selections add no restriction
 */
function applyHoursFilters(params: URLSearchParams, filters: HoursFilters) {
  if (filters.staffIds.length) params.set('staffIds', filters.staffIds.join(','));
  if (filters.categories.length) params.set('categories', filters.categories.join(','));
  if (filters.programIds.length) params.set('programIds', filters.programIds.join(','));
  if (filters.types.length) params.set('types', filters.types.join(','));
  if (filters.cycleIds?.length) params.set('cycleIds', filters.cycleIds.join(','));
  if (filters.search) params.set('search', filters.search);
}

/**
 * Loads pay-period totals for one staff member and cycle.
 * @example getHoursDashboardData(staffId, cycleId, { signal })
 */
export function getHoursDashboardData(staffId: string, cycleId: string, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId, cycleId });
  return apiClient.get<HoursDashboardData>(`/hours/dashboard?${params}`, opts);
}

/**
 * Loads assigned sessions available for logging on a date.
 * @example getHoursSessions(staffId, date, signal)
 */
export function getHoursSessions(staffId: string, date: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ staffId, date });
  return apiClient.get<HoursSession[]>(`/hours/sessions?${params}`, { signal });
}
/**
 * Creates or updates an Hours entry and returns its complete saved record.
 * @example setHours(input, itemId) // omit the ID to create
 */
export function setHours(input: SetHoursInput, id?: string) {
  return id
    ? apiClient.put<SetHoursResult>(`/hours/${id}`, input)
    : apiClient.post<SetHoursResult>('/hours', input);
}
/**
 * Moves an Hours entry to a work date and returns its saved record.
 * @example updateHoursPlacement(itemId, { date })
 */
export function updateHoursPlacement(id: string, input: UpdateHoursPlacementInput) {
  return apiClient.patch<HoursMutationResult>(`/hours/${id}/placement`, input);
}
/**
 * Deletes an Hours entry and returns its affected task records.
 * @example deleteHours(itemId)
 */
export function deleteHours(id: string) { return apiClient.delete<DeleteHoursResult>(`/hours/${id}`); }
