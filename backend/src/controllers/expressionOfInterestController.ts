import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { convertExpressionOfInterest, getExpressionsOfInterest, updateExpressionOfInterestStatus } from '../services/outreach/expressions/expressionOfInterestService';
import type { ExpressionOfInterestQuery, UpdateExpressionOfInterestStatusInput } from '../validation/expressionOfInterestSchemas';

export const handleGetExpressionsOfInterest = async (req: Request, res: Response) => {
  const filters = req.query as unknown as ExpressionOfInterestQuery;
  res.json(await getExpressionsOfInterest(filters));
};

export const handleUpdateExpressionOfInterestStatus = async (req: Request, res: Response) => {
  const submission = await updateExpressionOfInterestStatus(req.params.id, req.body as UpdateExpressionOfInterestStatusInput);
  res.json(submission);
};

export const handleConvertExpressionOfInterest = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await convertExpressionOfInterest(req.params.id, actorId));
};
