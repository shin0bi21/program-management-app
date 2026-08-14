import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createCohort,
  deleteCohort,
  deleteProgramCycle,
  getProgramCycles,
  setProgramCycle,
  updateCohort,
} from '../services/programming/cohorts/cohortService';
import { listCohorts } from '../services/programming/cohorts/cohortListService';
import { enrollYouth, withdrawYouth } from '../services/programming/cohorts/enrollmentService';
import {
  deleteSession,
  generateSessions,
  getSessionTypes,
  updateSession,
} from '../services/programming/sessions/sessionService';
import { listSessions } from '../services/programming/sessions/sessionListService';
import {
  getSessionRoster,
  setSessionAttendance,
} from '../services/programming/sessions/sessionAttendanceService';
import {
  createSessionNote,
  deleteSessionNote,
  getSessionNotes,
  unlinkYouthFromSessionNote,
  updateSessionNote,
} from '../services/programming/sessions/sessionNoteService';
import {
  createSessionAttachment,
  deleteSessionAttachment,
  getSessionAttachmentFile,
  getSessionAttachments,
  updateSessionAttachment,
} from '../services/programming/sessions/sessionAttachmentService';
import type {
  CreateCohortInput,
  CreateSessionAttachmentInput,
  UpdateSessionAttachmentInput,
  CreateSessionNoteInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  SetAttendanceInput,
  UpdateCohortInput,
  SetProgramCycleInput,
  UpdateSessionNoteInput,
  UpdateSessionInput,
} from '../validation/cohortSchemas';
import type { CohortQuery, CohortYouthReportQuery, SessionListQuery } from '../validation/cohortSchemas';
import { getCohortYouthReport } from '../services/programming/cohorts/cohortReportService';
import { generateCohortYouthReportPdf } from '../services/programming/cohorts/cohortReportPdfService';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetCohorts = async (req: Request, res: Response) => {
  const query = req.query as unknown as CohortQuery;
  res.json(await listCohorts(
    actor(req),
    query,
  ));
};

export const handleGetProgramCycles = async (_req: Request, res: Response) => {
  res.json(await getProgramCycles());
};

export const handleSetProgramCycle = async (req: Request, res: Response) => {
  const cycleId = req.params.cycleId;
  res.status(cycleId ? 200 : 201).json(await setProgramCycle(req.body as SetProgramCycleInput, actor(req), cycleId));
};

export const handleDeleteProgramCycle = async (req: Request, res: Response) => {
  await deleteProgramCycle(req.params.cycleId);
  res.json({ id: req.params.cycleId });
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
  const { youthId } = req.query as unknown as CohortYouthReportQuery;
  res.json(await getCohortYouthReport(req.params.cohortId, actor(req), youthId));
};

export const handleGetCohortYouthReportPdf = async (req: Request, res: Response) => {
  const { youthId } = req.query as unknown as CohortYouthReportQuery;
  const pdf = await generateCohortYouthReportPdf(req.params.cohortId, actor(req), youthId);
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
  res.json(await listSessions(actor(req), req.query as unknown as SessionListQuery));
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

export const handleSetSessionAttendance = async (req: Request, res: Response) => {
  res.json(await setSessionAttendance(req.params.sessionId, req.body as SetAttendanceInput, actor(req)));
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
