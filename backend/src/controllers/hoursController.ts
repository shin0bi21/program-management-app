import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  deleteHours,
  getHoursCalendarData,
  getHoursReferenceData,
  getHoursSessions,
  setHours,
  updateHoursPlacement,
} from '../services/staff/hours/hoursService';
import { getHoursDashboardData } from '../services/staff/hours/hoursDashboardService';
import { getHoursList } from '../services/staff/hours/hoursListService';
import type { HoursTableQuery, HoursDashboardQuery, HoursCalendarQuery, HoursSessionQuery } from '../validation/hoursSchemas';

/**
 * Returns hours for the requested calendar range.
 * @example handleGetHoursCalendarData(req, res)
 */
export async function handleGetHoursCalendarData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursCalendarQuery;
  res.json(await getHoursCalendarData(actor, query));
}

/**
 * Returns a page of hours entries.
 * @example handleGetHoursTableData(req, res)
 */
export async function handleGetHoursTableData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursTableQuery;
  res.json(await getHoursList(actor, query));
}

/**
 * Returns hours categories and sources.
 * @example handleGetHoursReferenceData(req, res)
 */
export async function handleGetHoursReferenceData(_req: Request, res: Response) {
  res.json(getHoursReferenceData());
}

/**
 * Returns the selected staff hours overview.
 * @example handleGetHoursDashboardData(req, res)
 */
export async function handleGetHoursDashboardData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursDashboardQuery;
  res.json(await getHoursDashboardData(actor, query));
}

/**
 * Returns sessions available for logging hours.
 * @example handleGetHoursSessions(req, res)
 */
export async function handleGetHoursSessions(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursSessionQuery;
  res.json(await getHoursSessions(actor, query));
}

/**
 * Creates or updates an hours entry.
 * @example handleSetHours(req, res)
 */
export async function handleSetHours(req: Request, res: Response) {
  const id = req.params.id;
  res.status(id ? 200 : 201).json(await setHours(req.body, (req as AuthRequest).user!, id));
}

/**
 * Moves an hours entry to its requested work date.
 * @example handleUpdateHoursPlacement(req, res)
 */
export async function handleUpdateHoursPlacement(req: Request, res: Response) {
  res.json(await updateHoursPlacement(req.params.id, req.body, (req as AuthRequest).user!));
}

/**
 * Deletes an hours entry.
 * @example handleDeleteHours(req, res)
 */
export async function handleDeleteHours(req: Request, res: Response) {
  res.status(200).json(await deleteHours(req.params.id, (req as AuthRequest).user!));
}
