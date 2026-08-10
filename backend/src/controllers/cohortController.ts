import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createCohort,
  createProgramCycle,
  deleteCohort,
  getCohorts,
  getProgramCycles,
  updateProgramCycle,
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
  unlinkYouthFromSessionNote,
  updateSessionNote,
} from '../services/sessionNoteService';
import {
  createSessionAttachment,
  deleteSessionAttachment,
  getSessionAttachmentFile,
  getSessionAttachments,
  updateSessionAttachment,
} from '../services/sessionAttachmentService';
import type {
  CreateCohortInput,
  CreateCycleInput,
  CreateSessionAttachmentInput,
  UpdateSessionAttachmentInput,
  CreateSessionNoteInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  SaveAttendanceInput,
  UpdateCohortInput,
  UpdateCycleInput,
  UpdateSessionNoteInput,
  UpdateSessionInput,
} from '../validation/cohortSchemas';
import { cohortQuerySchema, sessionListQuerySchema } from '../validation/cohortSchemas';
import { getCohortYouthReport } from '../services/cohortReportService';
import { generateCohortYouthReportPdf } from '../services/cohortReportPdfService';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetCohorts = async (req: Request, res: Response) => {
  const query = cohortQuerySchema.shape.query.parse(req.query);
  res.json(await getCohorts(
    actor(req),
    query,
  ));
};

export const handleGetProgramCycles = async (_req: Request, res: Response) => {
  res.json(await getProgramCycles());
};

export const handleCreateProgramCycle = async (req: Request, res: Response) => {
  res.status(201).json(await createProgramCycle(req.body as CreateCycleInput, actor(req)));
};

export const handleUpdateProgramCycle = async (req: Request, res: Response) => {
  res.json(await updateProgramCycle(req.params.cycleId, req.body as UpdateCycleInput, actor(req)));
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

export const handleGetCohortYouthReport = async (req: Request, res: Response) => {
  res.json(await getCohortYouthReport(req.params.cohortId, actor(req)));
};

export const handleGetCohortYouthReportPdf = async (req: Request, res: Response) => {
  const pdf = await generateCohortYouthReportPdf(req.params.cohortId, actor(req));
  const fallbackFilename = pdf.filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '-') || 'Youth Report.pdf';
  res.type('application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
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
  res.json(await getSessionList(actor(req), sessionListQuerySchema.shape.query.parse(req.query)));
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

export const handleUnlinkSessionNoteYouth = async (req: Request, res: Response) => {
  await unlinkYouthFromSessionNote(
    req.params.sessionId,
    req.params.noteId,
    req.params.youthId,
    actor(req),
  );
  res.json({ noteId: req.params.noteId, youthId: req.params.youthId });
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

export const handleUpdateSessionAttachment = async (req: Request, res: Response) => {
  res.json(await updateSessionAttachment(
    req.params.sessionId,
    req.params.attachmentId,
    req.body as UpdateSessionAttachmentInput,
    actor(req),
  ));
};

export const handleGetSessionAttachmentFile = async (req: Request, res: Response) => {
  const file = await getSessionAttachmentFile(req.params.sessionId, req.params.attachmentId, actor(req));
  res.type(file.mimeType);
  res.download(file.path, file.filename);
};
