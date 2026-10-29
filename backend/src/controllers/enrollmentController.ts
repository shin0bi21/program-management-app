import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

import { enrollYouth, withdrawYouth } from '../services/programming/cohorts/enrollmentService';

import type { EnrollYouthInput } from '../validation/cohortSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleEnrollYouth = async (req: Request, res: Response) => {
  res.status(201).json(await enrollYouth(req.params.cohortId, req.body as EnrollYouthInput, actor(req)));
};

export const handleWithdrawYouth = async (req: Request, res: Response) => {
  res.json(await withdrawYouth(req.params.cohortId, req.params.youthId, actor(req)));
};
