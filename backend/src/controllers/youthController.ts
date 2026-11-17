import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { listYouth } from '../services/youth/youthListService';
import { getYouthProfile, setYouthContacts, setYouthProfile } from '../services/youth/youthService';
import { listSessionNotesForYouth } from '../services/programming/sessions/sessionNoteService';
import { inviteYouthAccount } from '../services/accounts/accountService';
import type { SetYouthContactsInput, YouthQuery } from '../validation/youthSchemas';
import { deleteYouthProfileNote, getYouthProfileNotes, setYouthProfileNote } from '../services/youth/youthProfileNoteService';
import type { SetYouthProfileNoteInput } from '../validation/youthProfileNoteSchemas';
import { getAttendance, setAttendance, type AttendanceFilters } from '../services/attendanceService';
import type { SetAttendanceInput } from '../validation/youthSchemas';

/**
 * Returns the selected profile or a cursor page using the validated Youth filters.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleGetYouth(req, res)
 */
export const handleGetYouth = async (req: Request, res: Response) => {
  const filters = req.query as unknown as YouthQuery;
  res.json(filters.id ? await getYouthProfile(filters.id) : await listYouth(filters));
};

/**
 * Saves the supplied profile and optional invitation, then returns its authoritative record.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleSetYouth(req, res)
 */
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

/**
 * Saves only the selected profile's supplied contacts and returns the updated profile.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleSetYouthContacts(req, res)
 */
export const handleSetYouthContacts = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await setYouthContacts(req.params.id, req.body as SetYouthContactsInput, userId));
};

/**
 * Returns notes linked to the selected youth within the signed-in user's program scope.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleGetYouthSessionNotes(req, res)
 */
export const handleGetYouthSessionNotes = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.json(await listSessionNotesForYouth(req.params.id, user));
};

/**
 * Returns saved attendance grouped by program/cycle for the requested youth IDs and filters.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleGetYouthAttendance(req, res)
 */
export const handleGetYouthAttendance = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const filters = req.query as AttendanceFilters;
  res.json(await getAttendance(user, filters));
};

/**
 * Replaces the selected youth's validated cycle attendance and returns affected records.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleSetAttendance(req, res)
 */
export const handleSetAttendance = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.json(await setAttendance(
    req.params.id,
    req.params.programId,
    req.params.cycleId,
    req.body as SetAttendanceInput,
    user,
  ));
};

/**
 * Invites the selected youth using the validated email and returns the created account.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleInviteYouth(req, res)
 */
export const handleInviteYouth = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const account = await inviteYouthAccount(req.params.id, req.body.email, userId);
  res.status(201).json(account);
};

/**
 * Returns the selected profile's saved notes.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleGetYouthProfileNotes(req, res)
 */
export const handleGetYouthProfileNotes = async (req: Request, res: Response) => {
  res.json(await getYouthProfileNotes(req.params.id));
};

/**
 * Creates or updates the selected profile note and returns the saved note.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleSetYouthProfileNote(req, res)
 */
export const handleSetYouthProfileNote = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const noteId = req.params.noteId;
  res.status(noteId ? 200 : 201).json(await setYouthProfileNote(req.params.id, req.body as SetYouthProfileNoteInput, userId, noteId));
};

/**
 * Deletes the selected profile note and returns successful completion.
 * @param req - Authenticated request with validated Youth parameters and input.
 * @param res - Receives the operation's JSON result.
 * @example handleDeleteYouthProfileNote(req, res)
 */
export const handleDeleteYouthProfileNote = async (req: Request, res: Response) => {
  await deleteYouthProfileNote(req.params.id, req.params.noteId);
  res.json({ success: true });
};
