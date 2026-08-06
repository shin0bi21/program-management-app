import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createCohort,
  deleteCohort,
  getCohorts,
  updateCohort,
} from '../services/cohortService';
import { enrollYouth, withdrawYouth } from '../services/enrollmentService';
import {
  deleteSession,
  generateSessions,
  getSessionList,
  getSessionTypes,
  updateSession,
} from '../services/sessionService';
import {
  getSessionRoster,
  saveAttendance,
} from '../services/attendanceService';
import {
  createSessionNote,
  deleteSessionNote,
  getSessionNotes,
  updateSessionNote,
} from '../services/sessionNoteService';
import {
  createSessionAttachment,
  deleteSessionAttachment,
  getSessionAttachmentFile,
  getSessionAttachments,
} from '../services/sessionAttachmentService';
import type {
  CreateCohortInput,
  CreateSessionAttachmentInput,
  CreateSessionNoteInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  SessionListQuery,
  SaveAttendanceInput,
  UpdateCohortInput,
  UpdateSessionNoteInput,
  UpdateSessionInput,
} from '../validation/cohortSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetCohorts = async (req: Request, res: Response) => {
  res.json(await getCohorts(
    actor(req),
    req.query.programId as string | undefined,
    req.query.scope === 'all',
  ));
};

export const handleCreateCohort = async (req: Request, res: Response) => {
  res.status(201).json(await createCohort(req.body as CreateCohortInput, actor(req)));
};
export const handleUpdateCohort = async (req: Request, res: Response) => {
  res.json(await updateCohort(req.params.cohortId, req.body as UpdateCohortInput, actor(req)));
};
export const handleDeleteCohort = async (req: Request, res: Response) => {
  await deleteCohort(req.params.cohortId, actor(req));
  res.json({ id: req.params.cohortId });
};

export const handleEnrollYouth = async (req: Request, res: Response) => {
  res.status(201).json(await enrollYouth(req.params.cohortId, req.body as EnrollYouthInput, actor(req)));
};

export const handleWithdrawYouth = async (req: Request, res: Response) => {
  res.json(await withdrawYouth(req.params.cohortId, req.params.youthId, actor(req)));
};

export const handleGenerateSessions = async (req: Request, res: Response) => {
  res.status(201).json(await generateSessions(
    req.params.cohortId,
    req.body as GenerateSessionsInput,
    actor(req),
  ));
};

export const handleGetSessionList = async (req: Request, res: Response) => {
  res.json(await getSessionList(actor(req), req.query as SessionListQuery));
};
export const handleGetSessionTypes = async (_req: Request, res: Response) => {
  res.json(await getSessionTypes());
};
export const handleUpdateSession = async (req: Request, res: Response) => {
  res.json(await updateSession(req.params.sessionId, req.body as UpdateSessionInput, actor(req)));
};
export const handleDeleteSession = async (req: Request, res: Response) => {
  await deleteSession(req.params.sessionId, actor(req));
  res.json({ id: req.params.sessionId });
};

export const handleGetSessionRoster = async (req: Request, res: Response) => {
  res.json(await getSessionRoster(req.params.sessionId, actor(req)));
};

export const handleSaveAttendance = async (req: Request, res: Response) => {
  res.json(await saveAttendance(req.params.sessionId, req.body as SaveAttendanceInput, actor(req)));
};

export const handleGetSessionNotes = async (req: Request, res: Response) => {
  res.json(await getSessionNotes(req.params.sessionId, actor(req)));
};

export const handleCreateSessionNote = async (req: Request, res: Response) => {
  res.status(201).json(await createSessionNote(
    req.params.sessionId,
    req.body as CreateSessionNoteInput,
    actor(req),
  ));
};

export const handleUpdateSessionNote = async (req: Request, res: Response) => {
  res.json(await updateSessionNote(
    req.params.sessionId,
    req.params.noteId,
    req.body as UpdateSessionNoteInput,
    actor(req),
  ));
};

export const handleDeleteSessionNote = async (req: Request, res: Response) => {
  await deleteSessionNote(req.params.sessionId, req.params.noteId, actor(req));
  res.json({ id: req.params.noteId });
};

export const handleGetSessionAttachments = async (req: Request, res: Response) => {
  res.json(await getSessionAttachments(req.params.sessionId, actor(req)));
};

export const handleCreateSessionAttachment = async (req: Request, res: Response) => {
  res.status(201).json(await createSessionAttachment(
    req.params.sessionId,
    req.body as CreateSessionAttachmentInput,
    req.file,
    actor(req),
  ));
};

export const handleDeleteSessionAttachment = async (req: Request, res: Response) => {
  await deleteSessionAttachment(req.params.sessionId, req.params.attachmentId, actor(req));
  res.json({ id: req.params.attachmentId });
};

export const handleGetSessionAttachmentFile = async (req: Request, res: Response) => {
  const file = await getSessionAttachmentFile(req.params.sessionId, req.params.attachmentId, actor(req));
  res.type(file.mimeType);
  res.download(file.path, file.filename);
};
