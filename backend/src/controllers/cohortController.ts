import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  createCohort,
  deleteCohort,
  getCohorts,
  updateCohort,
} from '../services/cohortService';
import { enrollYouth, syncYouthCohorts, withdrawYouth } from '../services/enrollmentService';
import {
  generateSessions,
  getSessionList,
  getSessions,
  deleteSession,
  updateSession,
} from '../services/sessionService';
import {
  getSessionRoster,
  saveAttendance,
} from '../services/attendanceService';
import type {
  CreateCohortInput,
  EnrollYouthInput,
  GenerateSessionsInput,
  SessionListQuery,
  SaveAttendanceInput,
  SyncYouthCohortsInput,
  UpdateCohortInput,
  UpdateSessionInput,
} from '../validation/cohortSchemas';

const actorId = (req: Request) => (req as AuthRequest).user!.userId;

export const handleGetCohorts = async (req: Request, res: Response) => {
  res.json(await getCohorts(req.query.programId as string | undefined));
};

export const handleCreateCohort = async (req: Request, res: Response) => {
  res.status(201).json(await createCohort(req.body as CreateCohortInput, actorId(req)));
};
export const handleUpdateCohort = async (req: Request, res: Response) => {
  res.json(await updateCohort(req.params.cohortId, req.body as UpdateCohortInput, actorId(req)));
};
export const handleDeleteCohort = async (req: Request, res: Response) => {
  await deleteCohort(req.params.cohortId);
  res.json({ id: req.params.cohortId });
};

export const handleEnrollYouth = async (req: Request, res: Response) => {
  res.status(201).json(await enrollYouth(req.params.cohortId, req.body as EnrollYouthInput, actorId(req)));
};

export const handleWithdrawYouth = async (req: Request, res: Response) => {
  res.json(await withdrawYouth(req.params.cohortId, req.params.youthId, actorId(req)));
};

export const handleSyncYouthCohorts = async (req: Request, res: Response) => {
  res.json(await syncYouthCohorts(
    req.params.youthId,
    req.body as SyncYouthCohortsInput,
    actorId(req),
  ));
};

export const handleGenerateSessions = async (req: Request, res: Response) => {
  res.status(201).json(await generateSessions(
    req.params.cohortId,
    req.body as GenerateSessionsInput,
    actorId(req),
  ));
};

export const handleGetSessions = async (req: Request, res: Response) => {
  res.json(await getSessions(req.query.start as string, req.query.end as string));
};

export const handleGetSessionList = async (req: Request, res: Response) => {
  res.json(await getSessionList(req.query as SessionListQuery));
};
export const handleUpdateSession = async (req: Request, res: Response) => {
  res.json(await updateSession(req.params.sessionId, req.body as UpdateSessionInput, actorId(req)));
};
export const handleDeleteSession = async (req: Request, res: Response) => {
  await deleteSession(req.params.sessionId);
  res.json({ id: req.params.sessionId });
};

export const handleGetSessionRoster = async (req: Request, res: Response) => {
  res.json(await getSessionRoster(req.params.sessionId));
};

export const handleSaveAttendance = async (req: Request, res: Response) => {
  res.json(await saveAttendance(req.params.sessionId, req.body as SaveAttendanceInput, actorId(req)));
};
