import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getYouth, getYouthSessionNotes, setYouth } from '../services/youthService';
import { inviteYouthAccount } from '../services/accountService';
import type { YouthQuery } from '../validation/youthSchemas';
import { createYouthProfileNote, deleteYouthProfileNote, getYouthProfileNotes, updateYouthProfileNote } from '../services/youthProfileNoteService';
import type { SetYouthProfileNoteInput } from '../validation/youthProfileNoteSchemas';
import { getYouthCohortAttendance, setYouthCohortAttendance } from '../services/youthAttendanceService';
import type { SetYouthCohortAttendanceInput } from '../validation/youthSchemas';

export const handleGetYouth = async (req: Request, res: Response) => {
  const filters = req.query as unknown as YouthQuery;
  res.json(filters.id ? await getYouth(filters.id) : await getYouth(undefined, filters));
};

export const handleSetYouth = async (req: Request, res: Response) => {
  const { id, email } = req.body;
  const userId = (req as AuthRequest).user!.userId;
  let saved = await setYouth(req.body, userId);
  if (email && !saved.account) {
    const account = await inviteYouthAccount(saved.id, email, userId);
    saved = { ...saved, account };
  }
  res.status(id ? 200 : 201).json(saved);
};

export const handleGetYouthSessionNotes = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await getYouthSessionNotes(req.params.id, actor));
};

export const handleGetYouthCohortAttendance = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await getYouthCohortAttendance(req.params.id, req.params.cohortId, actor));
};

export const handleSetYouthCohortAttendance = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await setYouthCohortAttendance(
    req.params.id,
    req.params.cohortId,
    req.body as SetYouthCohortAttendanceInput,
    actor,
  ));
};

export const handleInviteYouth = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const account = await inviteYouthAccount(req.params.id, req.body.email, actorId);
  res.status(201).json(account);
};

export const handleGetYouthProfileNotes = async (req: Request, res: Response) => {
  res.json(await getYouthProfileNotes(req.params.id));
};
export const handleCreateYouthProfileNote = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createYouthProfileNote(req.params.id, req.body as SetYouthProfileNoteInput, actorId));
};
export const handleUpdateYouthProfileNote = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateYouthProfileNote(req.params.id, req.params.noteId, req.body as SetYouthProfileNoteInput, actorId));
};
export const handleDeleteYouthProfileNote = async (req: Request, res: Response) => {
  await deleteYouthProfileNote(req.params.id, req.params.noteId);
  res.json({ success: true });
};
