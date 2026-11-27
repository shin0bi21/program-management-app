import { intersectDateRanges, type DateRange } from '../../../common/utils/dateRange';
import type { Session } from '../../../common/features/programming/sessions/types';
import { apiClient } from '../../../http/client';
import type { RequestOptions } from '../../../http/client';
import type { CursorPage, CursorRequest } from '../../../query/types';
import type { Task } from '../Tasks/types';
import type {
  HoursCategory,
  Hours,
  HoursFilters,
} from './types';

export type HoursMutationResult = Hours & { updatedTasks?: Task[] };
type DeleteHoursResult = Pick<HoursMutationResult, 'updatedTasks'> & { message: string };

type SessionOption = Pick<Session, 'id' | 'date' | 'title'>;

export interface HoursReferenceData {
  categories: Array<{ id: HoursCategory; name: string }>;
  types: Array<{ id: Hours['type']; name: string }>;
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
  range: DateRange,
  opts?: RequestOptions,
): Promise<Hours[]> {
  const requestedRange = intersectDateRanges(range, filters.dateRange);
  if (!requestedRange) return Promise.resolve([]);

  const params = new URLSearchParams({ ...requestedRange });
  applyHoursFilters(params, filters);
  return apiClient.get<Hours[]>(`/hours/calendar?${params}`, opts);
}

/**
 * Loads supported Hours categories and source types.
 * @param opts - Request cancellation options.
 * @example getHoursReferenceData({ signal })
 */
export function getHoursReferenceData(opts?: RequestOptions): Promise<HoursReferenceData> {
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
): Promise<CursorPage<Hours>> {
  const params = new URLSearchParams({
    sort: pagination.key, direction: pagination.direction,
  });
  if (pagination.cursor) params.set('cursor', pagination.cursor);
  applyHoursFilters(params, filters);
  if (filters.dateRange) {
    params.set('start', filters.dateRange.start);
    params.set('end', filters.dateRange.end);
  }
  return apiClient.get<CursorPage<Hours>>(`/hours/table?${params}`, opts);
}

/**
 * Loads one staff member's pay-period totals independently of the selected cycle.
 * @param staffId - Staff member whose readable hours are summarized.
 * @param date - Date within the desired pay period; null requests the current period.
 * @param opts - Request cancellation options.
 * @example getHoursPayPeriodData(staffId, null, { signal })
 */
export function getHoursPayPeriodData(
  staffId: Hours['staffId'],
  date: Hours['date'] | null,
  opts?: RequestOptions,
): Promise<HoursPayPeriodData> {
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
export function getHoursCycleSummaryData(
  staffId: Hours['staffId'],
  cycleId: Hours['cycleId'],
  opts?: RequestOptions,
): Promise<HoursCycleSummaryData> {
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
export function getHoursSessions(staffId: Hours['staffId'], date: Hours['date'], signal?: AbortSignal): Promise<SessionOption[]> {
  const params = new URLSearchParams({ staffId, date });
  return apiClient.get<SessionOption[]>(`/hours/sessions?${params}`, { signal });
}

/**
 * Creates or updates an Hours entry and returns its complete saved record.
 * @param input - Complete creation fields or the fields to change on an existing entry.
 * @param id - Saved entry ID to update; omit it to create an entry.
 * @param completeTask - Whether creating task-linked hours should also complete the task.
 * @example setHours(input, itemId) // omit the ID to create
 */
export function setHours(input: Partial<Hours>, id?: Hours['id'], completeTask = false): Promise<HoursMutationResult> {
  if (id) return apiClient.patch<HoursMutationResult>(`/hours/${id}`, input);

  return apiClient.post<HoursMutationResult>('/hours', completeTask ? { ...input, completeTask } : input);
}

/**
 * Deletes an Hours entry and returns its affected task records.
 * @param id - Saved entry ID to delete.
 * @example deleteHours(itemId)
 */
export function deleteHours(id: Hours['id']): Promise<DeleteHoursResult> {
  return apiClient.delete<DeleteHoursResult>(`/hours/${id}`);
}

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
