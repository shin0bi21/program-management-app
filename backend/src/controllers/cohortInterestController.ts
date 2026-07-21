import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { convertCohortInterestSubmission, getCohortInterestSubmissions, updateCohortInterestStatus } from '../services/cohortInterestService';
import type { UpdateCohortInterestStatusInput } from '../validation/cohortInterestSchemas';

export const handleGetCohortInterestSubmissions = async (_req: Request, res: Response) => {
  res.json(await getCohortInterestSubmissions());
};

export const handleUpdateCohortInterestStatus = async (req: Request, res: Response) => {
  const submission = await updateCohortInterestStatus(req.params.id, req.body as UpdateCohortInterestStatusInput);
  res.json(submission);
};

export const handleConvertCohortInterestSubmission = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await convertCohortInterestSubmission(req.params.id, actorId));
};
