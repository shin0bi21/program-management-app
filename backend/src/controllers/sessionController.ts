import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

import { createProgramSession, createSession, moveSessionDate, deleteSession, getSessionTypes, updateSession } from '../services/programming/sessions/sessionService';
import { getSessionReferenceData } from '../services/programming/sessions/sessionReferenceDataService';
import { listSessions } from '../services/programming/sessions/sessionListService';
import { getSessionRoster, setSessionAttendance } from '../services/programming/sessions/sessionAttendanceService';
import { createSessionNote, deleteSessionNote, getSessionNotes, unlinkYouthFromSessionNote, updateSessionNote } from '../services/programming/sessions/sessionNoteService';
import { createSessionAttachment, deleteSessionAttachment, getSessionAttachmentFile, getSessionAttachments, updateSessionAttachment } from '../services/programming/sessions/sessionAttachmentService';
import type { CreateProgramSessionInput, CreateSessionInput, CreateSessionAttachmentInput, UpdateSessionAttachmentInput, CreateSessionNoteInput, SetAttendanceInput, UpdateSessionNoteInput, UpdateSessionInput } from '../validation/programmingSchemas';
import type { SessionListQuery } from '../validation/programmingSchemas';

/**
 * Reads the user attached by authentication middleware.
 * @example user(authenticatedRequest) // the authenticated user's access-token claims
 */
const user = (req: Request) => (req as AuthRequest).user!;

export const handleGetSessionList = async (req: Request, res: Response) => {
  res.json(await listSessions(user(req), req.query as unknown as SessionListQuery));
};

export const handleGetSessionReferenceData = async (req: Request, res: Response) => {
  res.json(await getSessionReferenceData(user(req)));
};

export const handleGetSessionTypes = async (_req: Request, res: Response) => {
  res.json(await getSessionTypes());
};

export const handleCreateProgramSession = async (req: Request, res: Response) => {
  const { programId, ...data } = req.body as CreateProgramSessionInput;
  res.status(201).json(await createProgramSession(programId, data, user(req)));
};

export const handleCreateSession = async (req: Request, res: Response) => {
  res.status(201).json(await createSession(req.params.programId, req.params.cycleId, req.body as CreateSessionInput, user(req)));
};

export const handleMoveSessionDate = async (req: Request, res: Response) => {
  res.json(await moveSessionDate(req.params.sessionId, req.body.date as string, user(req)));
};

export const handleGetSessionRoster = async (req: Request, res: Response) => {
  res.json(await getSessionRoster(req.params.sessionId, user(req)));
};

export const handleSetSessionAttendance = async (req: Request, res: Response) => {
  res.json(await setSessionAttendance(req.params.sessionId, req.body as SetAttendanceInput, user(req)));
};

export const handleGetSessionNotes = async (req: Request, res: Response) => {
  res.json(await getSessionNotes(req.params.sessionId, user(req)));
};

export const handleCreateSessionNote = async (req: Request, res: Response) => {
  res.status(201).json(await createSessionNote(
    req.params.sessionId,
    req.body as CreateSessionNoteInput,
    user(req),
  ));
};

export const handleUpdateSessionNote = async (req: Request, res: Response) => {
  res.json(await updateSessionNote(
    req.params.sessionId,
    req.params.noteId,
    req.body as UpdateSessionNoteInput,
    user(req),
  ));
};

export const handleUnlinkSessionNoteYouth = async (req: Request, res: Response) => {
  await unlinkYouthFromSessionNote(
    req.params.sessionId,
    req.params.noteId,
    req.params.youthId,
    user(req),
  );
  res.json({ noteId: req.params.noteId, youthId: req.params.youthId });
};

export const handleDeleteSessionNote = async (req: Request, res: Response) => {
  await deleteSessionNote(req.params.sessionId, req.params.noteId, user(req));
  res.json({ id: req.params.noteId });
};

export const handleGetSessionAttachments = async (req: Request, res: Response) => {
  res.json(await getSessionAttachments(req.params.sessionId, user(req)));
};

export const handleCreateSessionAttachment = async (req: Request, res: Response) => {
  res.status(201).json(await createSessionAttachment(
    req.params.sessionId,
    req.body as CreateSessionAttachmentInput,
    req.file,
    user(req),
  ));
};

export const handleGetSessionAttachmentFile = async (req: Request, res: Response) => {
  const file = await getSessionAttachmentFile(req.params.sessionId, req.params.attachmentId, user(req));
  res.type(file.mimeType);
  res.download(file.path, file.filename);
};

export const handleUpdateSessionAttachment = async (req: Request, res: Response) => {
  res.json(await updateSessionAttachment(
    req.params.sessionId,
    req.params.attachmentId,
    req.body as UpdateSessionAttachmentInput,
    user(req),
  ));
};

export const handleDeleteSessionAttachment = async (req: Request, res: Response) => {
  await deleteSessionAttachment(req.params.sessionId, req.params.attachmentId, user(req));
  res.json({ id: req.params.attachmentId });
};

export const handleUpdateSession = async (req: Request, res: Response) => {
  res.json(await updateSession(req.params.sessionId, req.body as UpdateSessionInput, user(req)));
};

export const handleDeleteSession = async (req: Request, res: Response) => {
  res.json(await deleteSession(req.params.sessionId, user(req)));
};
