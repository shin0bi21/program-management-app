import { Request, Response } from 'express';
import { getCohortInterestSubmissions, updateCohortInterestStatus } from '../services/cohortInterestService';
import type { UpdateCohortInterestStatusInput } from '../validation/cohortInterestSchemas';

export const handleGetCohortInterestSubmissions = async (_req: Request, res: Response) => {
  res.json(await getCohortInterestSubmissions());
};

export const handleUpdateCohortInterestStatus = async (req: Request, res: Response) => {
  const submission = await updateCohortInterestStatus(req.params.id, req.body as UpdateCohortInterestStatusInput);
  res.json(submission);
};
