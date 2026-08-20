import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  deleteHours,
  getHours,
  getHoursOptions,
  getHoursOverview,
  getHoursSessions,
  setHours,
  updateHoursPlacement,
} from '../services/staff/hours/hoursService';
import { getHoursList } from '../services/staff/hours/hoursListService';
import type { HoursListQuery, HoursOverviewQuery, HoursQuery, HoursSessionQuery } from '../validation/hoursSchemas';

export async function handleGetHours(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursQuery;
  res.json(await getHours(actor, query));
}

export async function handleGetHoursList(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursListQuery;
  res.json(await getHoursList(actor, query));
}

export async function handleGetHoursOptions(req: Request, res: Response) {
  res.json(await getHoursOptions((req as AuthRequest).user!));
}

export async function handleGetHoursOverview(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as HoursOverviewQuery;
  res.json(await getHoursOverview(actor, query));
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
