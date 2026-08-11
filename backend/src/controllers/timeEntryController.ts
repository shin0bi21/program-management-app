import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntries,
  getTimeEntryCohorts,
  getTimeEntryOverview,
  getTimeEntrySessions,
  updateTimeEntry,
  updateTimeEntryPlacement,
} from '../services/timeEntryService';
import { timeEntryCohortQuerySchema, timeEntryOverviewQuerySchema, timeEntryQuerySchema, timeEntrySessionQuerySchema } from '../validation/timeEntrySchemas';

export async function handleGetTimeEntries(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = timeEntryQuerySchema.shape.query.parse(req.query);
  res.json(await getTimeEntries(actor, query));
}

export async function handleGetTimeEntryCohorts(req: Request, res: Response) {
  const query = timeEntryCohortQuerySchema.shape.query.parse(req.query);
  res.json(await getTimeEntryCohorts(query.programId));
}

export async function handleGetTimeEntryOverview(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = timeEntryOverviewQuerySchema.shape.query.parse(req.query);
  res.json(await getTimeEntryOverview(actor, query));
}

export async function handleGetTimeEntrySessions(req: Request, res: Response) {
  const actor = (req as AuthRequest).user!;
  const query = timeEntrySessionQuerySchema.shape.query.parse(req.query);
  res.json(await getTimeEntrySessions(actor, query));
}

export async function handleCreateTimeEntry(req: Request, res: Response) {
  res.status(201).json(await createTimeEntry(req.body, (req as AuthRequest).user!));
}

export async function handleUpdateTimeEntry(req: Request, res: Response) {
  res.json(await updateTimeEntry(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleUpdateTimeEntryPlacement(req: Request, res: Response) {
  res.json(await updateTimeEntryPlacement(req.params.id, req.body, (req as AuthRequest).user!));
}

export async function handleDeleteTimeEntry(req: Request, res: Response) {
  await deleteTimeEntry(req.params.id, (req as AuthRequest).user!);
  res.status(200).json({ message: 'Time entry deleted' });
}
