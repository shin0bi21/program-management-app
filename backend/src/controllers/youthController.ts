import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { listYouth } from '../services/youth/youthListService';
import { getYouthProfile, setYouthContacts, setYouthProfile } from '../services/youth/youthService';
import { listSessionNotesForYouth } from '../services/programming/sessions/sessionNoteService';
import { inviteYouthAccount } from '../services/accounts/accountService';
import type { SetYouthContactsInput, YouthQuery } from '../validation/youthSchemas';
import { deleteYouthProfileNote, getYouthProfileNotes, setYouthProfileNote } from '../services/youth/youthProfileNoteService';
import type { SetYouthProfileNoteInput } from '../validation/youthProfileNoteSchemas';
import { getYouthCohortAttendance, setYouthCohortAttendance } from '../services/youth/youthAttendanceService';
import type { SetYouthCohortAttendanceInput } from '../validation/youthSchemas';

export const handleGetYouth = async (req: Request, res: Response) => {
  const filters = req.query as unknown as YouthQuery;
  res.json(filters.id ? await getYouthProfile(filters.id) : await listYouth(filters));
};

export const handleSetYouth = async (req: Request, res: Response) => {
  const { id, email } = req.body;
  const userId = (req as AuthRequest).user!.userId;
  let saved = await setYouthProfile(req.body, userId);
  if (email && !saved.account) {
    const account = await inviteYouthAccount(saved.id, email, userId);
    saved = { ...saved, account };
  }
  res.status(id ? 200 : 201).json(saved);
};

export const handleSetYouthContacts = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await setYouthContacts(req.params.id, req.body as SetYouthContactsInput, actorId));
};

export const handleGetYouthSessionNotes = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await listSessionNotesForYouth(req.params.id, actor));
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
export const handleSetYouthProfileNote = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const noteId = req.params.noteId;
  res.status(noteId ? 200 : 201).json(await setYouthProfileNote(req.params.id, req.body as SetYouthProfileNoteInput, actorId, noteId));
};
export const handleDeleteYouthProfileNote = async (req: Request, res: Response) => {
  await deleteYouthProfileNote(req.params.id, req.params.noteId);
  res.json({ success: true });
};
