import { intersectDateRanges } from '../../../common/utils/dateRange';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { CursorPage, CursorRequest } from '../../../query/types';
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
}

export interface HoursReferenceData {
  categories: Array<{ value: HoursCategory; label: string }>;
  types: Array<{ value: HoursItemType; label: string }>;
}

export interface HoursPayPeriodData {
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  breakdown: Array<{ label: string; hours: number }>;
}

export interface HoursCycleSummaryData {
  periodCount: number;
  averageHours: number;
  breakdown: Array<{ label: string; hours: number }>;
}

/**
 * Loads Hours entries within the visible and applied date ranges.
 * @param filters - Applied staff, category, program, source, cycle, search, and date restrictions.
 * @param range - Inclusive calendar buffer dates; requests are clipped to the applied range.
 * @param opts - Request cancellation options.
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
 * @param opts - Request cancellation options.
 * @example getHoursReferenceData({ signal })
 */
export function getHoursReferenceData(opts?: RequestOptions) {
  return apiClient.get<HoursReferenceData>('/hours/reference-data', opts);
}

/**
 * Loads one filtered, sorted Hours page.
 * @param filters - Applied restrictions shared with the calendar.
 * @param opts - Request cancellation options.
 * @param pagination - Server sort field, direction, and optional continuation cursor.
 * @example getHoursTableData(filters, { signal }, pagination)
 */
export function getHoursTableData(
  filters: HoursFilters,
  opts: RequestOptions | undefined,
  pagination: CursorRequest,
) {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction,
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
 * Loads one staff member's pay-period totals independently of the selected cycle.
 * @param staffId - Staff member whose readable hours are summarized.
 * @param date - Date within the desired pay period; null requests the current period.
 * @param opts - Request cancellation options.
 * @example getHoursPayPeriodData(staffId, null, { signal })
 */
export function getHoursPayPeriodData(staffId: string, date: string | null, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId });
  if (date) params.set('date', date);

  return apiClient.get<HoursPayPeriodData>(`/hours/pay-period?${params}`, opts);
}

/**
 * Loads one staff member's biweekly average within the selected cycle.
 * @param staffId - Staff member whose readable hours are summarized.
 * @param cycleId - Cycle used for the totals and elapsed pay-period count.
 * @param opts - Request cancellation options.
 * @example getHoursCycleSummaryData(staffId, cycleId, { signal })
 */
export function getHoursCycleSummaryData(staffId: string, cycleId: string, opts?: RequestOptions) {
  const params = new URLSearchParams({ staffId, cycleId });
  return apiClient.get<HoursCycleSummaryData>(`/hours/cycle-summary?${params}`, opts);
}

/**
 * Loads assigned sessions available for logging on a date.
 * @param staffId - Staff member whose assigned sessions are requested.
 * @param date - Work date in YYYY-MM-DD format.
 * @param signal - Cancels the session lookup when the caller departs.
 * @example getHoursSessions(staffId, date, signal)
 */
export function getHoursSessions(staffId: string, date: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ staffId, date });
  return apiClient.get<HoursSession[]>(`/hours/sessions?${params}`, { signal });
}

/**
 * Creates or updates an Hours entry and returns its complete saved record.
 * @param input - Source-specific hours command, including staff and decimal hours.
 * @param id - Saved entry ID to update; omit it to create an entry.
 * @example setHours(input, itemId) // omit the ID to create
 */
export function setHours(input: SetHoursInput, id?: string) {
  return id
    ? apiClient.put<SetHoursResult>(`/hours/${id}`, input)
    : apiClient.post<SetHoursResult>('/hours', input);
}

/**
 * Moves an Hours entry to a work date and returns its saved record.
 * @param id - Saved entry ID to move.
 * @param input - New work date in YYYY-MM-DD format.
 * @example updateHoursPlacement(itemId, { date })
 */
export function updateHoursPlacement(id: string, input: UpdateHoursPlacementInput) {
  return apiClient.patch<HoursMutationResult>(`/hours/${id}/placement`, input);
}

/**
 * Deletes an Hours entry and returns its affected task records.
 * @param id - Saved entry ID to delete.
 * @example deleteHours(itemId)
 */
export function deleteHours(id: string) { return apiClient.delete<DeleteHoursResult>(`/hours/${id}`); }

/**
 * Adds selected Hours filters to the request parameters.
 * @param params - Request parameters to update in place.
 * @param filters - Applied restrictions; empty selections leave that field unrestricted.
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
