import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { listYouth } from '../services/youth/youthListService';
import { getYouthProfile, setYouthContacts, setYouthProfile } from '../services/youth/youthService';
import { listSessionNotesForYouth } from '../services/programming/sessions/sessionNoteService';
import { inviteYouthAccount } from '../services/accounts/accountService';
import type { SetYouthContactsInput, YouthQuery } from '../validation/youthSchemas';
import { deleteYouthProfileNote, getYouthProfileNotes, setYouthProfileNote } from '../services/youth/youthProfileNoteService';
import type { SetYouthProfileNoteInput } from '../validation/youthProfileNoteSchemas';
import { getYouthProgramCycleAttendance, setYouthProgramCycleAttendance } from '../services/youth/youthAttendanceService';
import type { SetYouthProgramCycleAttendanceInput } from '../validation/youthSchemas';
import { getYouthAttendanceSummary } from '../services/youth/youthAttendanceSummaryService';

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

export const handleGetYouthAttendanceSummary = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await getYouthAttendanceSummary(req.params.id, actor));
};

export const handleGetYouthProgramCycleAttendance = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await getYouthProgramCycleAttendance(req.params.id, req.params.programId, req.params.cycleId, actor));
};

export const handleSetYouthProgramCycleAttendance = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await setYouthProgramCycleAttendance(
    req.params.id,
    req.params.programId,
    req.params.cycleId,
    req.body as SetYouthProgramCycleAttendanceInput,
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
