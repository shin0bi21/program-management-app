import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { convertExpressionOfInterest, getExpressionsOfInterest, updateExpressionOfInterestStatus } from '../services/expressionOfInterestService';
import type { UpdateExpressionOfInterestStatusInput } from '../validation/expressionOfInterestSchemas';

export const handleGetExpressionsOfInterest = async (_req: Request, res: Response) => {
  res.json(await getExpressionsOfInterest());
};

export const handleUpdateExpressionOfInterestStatus = async (req: Request, res: Response) => {
  const submission = await updateExpressionOfInterestStatus(req.params.id, req.body as UpdateExpressionOfInterestStatusInput);
  res.json(submission);
};

export const handleConvertExpressionOfInterest = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await convertExpressionOfInterest(req.params.id, actorId));
};
