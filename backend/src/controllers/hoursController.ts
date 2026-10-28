import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  deleteHours,
  getHoursCalendarData,
  getHoursReferenceData,
  getHoursDashboardData,
  getHoursSessions,
  setHours,
  updateHoursPlacement,
} from '../services/staff/hours/hoursService';
import { getHoursList } from '../services/staff/hours/hoursListService';
import type { HoursTableQuery, HoursDashboardQuery, HoursCalendarQuery, HoursSessionQuery } from '../validation/hoursSchemas';

export async function handleGetHoursCalendarData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursCalendarQuery;
  res.json(await getHoursCalendarData(actor, query));
}

export async function handleGetHoursTableData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursTableQuery;
  res.json(await getHoursList(actor, query));
}

export async function handleGetHoursReferenceData(_req: Request, res: Response) {
  res.json(getHoursReferenceData());
}

export async function handleGetHoursDashboardData(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursDashboardQuery;
  res.json(await getHoursDashboardData(actor, query));
}

export async function handleGetHoursSessions(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursSessionQuery;
  res.json(await getHoursSessions(actor, query));
}

export async function handleSetHours(req: Request, res: Response) {
  const id = req.params.id;
  res.status(id ? 200 : 201).json(await setHours(req.body, (req as AuthRequest).user!, id));
}

export async function handleUpdateHoursPlacement(req: Request, res: Response) {
  res.json(await updateHoursPlacement(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleDeleteHours(req: Request, res: Response) {
  await deleteHours(req.params.id, (req as AuthRequest).user!);
  res.status(200).json({ message: 'Logged hours deleted' });
}
