import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

import { enrollYouth, withdrawYouth } from '../services/programming/programCycles/enrollmentService';

import type { EnrollYouthInput } from '../validation/programmingSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleEnrollYouth = async (req: Request, res: Response) => {
  res.status(201).json(await enrollYouth(req.params.programId, req.params.cycleId, req.body as EnrollYouthInput, actor(req)));
};

export const handleWithdrawYouth = async (req: Request, res: Response) => {
  res.json(await withdrawYouth(req.params.programId, req.params.cycleId, req.params.youthId, actor(req)));
};
