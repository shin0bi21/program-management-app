import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { deleteProgramCycle, getProgramCycles, setProgramCycle } from '../services/programming/cycles/programCycleService';

import { listCycles } from '../services/programming/cycles/cycleListService';

import type { SetProgramCycleInput, CycleListQuery } from '../validation/programmingSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetProgramCycles = async (_req: Request, res: Response) => {
  res.json(await getProgramCycles());
};

export const handleGetCycleList = async (req: Request, res: Response) => {
  res.json(await listCycles(req.query as unknown as CycleListQuery));
};

export const handleSetProgramCycle = async (req: Request, res: Response) => {
  const cycleId = req.params.cycleId;
  res.status(cycleId ? 200 : 201).json(await setProgramCycle(req.body as SetProgramCycleInput, actor(req), cycleId));
};

export const handleDeleteProgramCycle = async (req: Request, res: Response) => {
  await deleteProgramCycle(req.params.cycleId);
  res.json({ id: req.params.cycleId });
};
