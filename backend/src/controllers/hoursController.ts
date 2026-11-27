import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  deleteHours,
  getHoursCalendarData,
  getHoursReferenceData,
  getHoursSessions,
  setHours,
} from '../services/staff/hours/hoursService';
import { getHoursCycleSummaryData, getHoursPayPeriodData } from '../services/staff/hours/hoursDashboardService';
import { getHoursList } from '../services/staff/hours/hoursListService';
import type { HoursTableQuery, HoursCycleSummaryQuery, HoursPayPeriodQuery, HoursCalendarQuery, HoursSessionQuery } from '../validation/hoursSchemas';

/**
 * Returns hours for the requested calendar range.
 * @example handleGetHoursCalendarData(req, res)
 */
export async function handleGetHoursCalendarData(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursCalendarQuery;
  res.json(await getHoursCalendarData(user, query));
}

/**
 * Returns a page of hours entries.
 * @example handleGetHoursTableData(req, res)
 */
export async function handleGetHoursTableData(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursTableQuery;
  res.json(await getHoursList(user, query));
}

/**
 * Returns hours categories and sources.
 * @example handleGetHoursReferenceData(req, res)
 */
export async function handleGetHoursReferenceData(_req: Request, res: Response) {
  res.json(getHoursReferenceData());
}

/**
 * Returns the selected staff member's pay-period totals.
 * @example handleGetHoursPayPeriodData(req, res)
 */
export async function handleGetHoursPayPeriodData(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursPayPeriodQuery;
  res.json(await getHoursPayPeriodData(user, query));
}

/**
 * Returns the selected staff member's cycle biweekly average.
 * @example handleGetHoursCycleSummaryData(req, res)
 */
export async function handleGetHoursCycleSummaryData(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursCycleSummaryQuery;
  res.json(await getHoursCycleSummaryData(user, query));
}

/**
 * Returns sessions available for logging hours.
 * @example handleGetHoursSessions(req, res)
 */
export async function handleGetHoursSessions(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursSessionQuery;
  res.json(await getHoursSessions(user, query));
}

/**
 * Creates an hours entry on POST or updates the supplied ID on PATCH.
 * PATCH preserves omitted fields and returns 404 when the target is missing.
 * @example handleSetHours(req, res)
 */
export async function handleSetHours(req: Request, res: Response) {
  const user = (req as AuthRequest).user!;
  const { id } = req.params;
  const { completeTask, ...fields } = req.body;
  const saved = await setHours({ ...fields, ...(id ? { id } : {}) }, user, completeTask);
  res.status(id ? 200 : 201).json(saved);
}

/**
 * Deletes an hours entry.
 * @example handleDeleteHours(req, res)
 */
export async function handleDeleteHours(req: Request, res: Response) {
  res.status(200).json(await deleteHours(req.params.id, (req as AuthRequest).user!));
}
