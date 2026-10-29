import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createProgram, getPrograms, updateProgram } from '../services/programService';
import { getProgramList } from '../services/programming/programs/programListService';
import { setProgramCycles } from '../services/programming/cohorts/assignmentService';
import type { CreateProgramInput, UpdateProgramInput, SetProgramCyclesInput, ProgramListQuery } from '../validation/programSchemas';

export const handleGetPrograms = async (req: Request, res: Response) => {
  res.json(await getPrograms((req as AuthRequest).user!, req.query.scope === 'assigned'));
};

export const handleGetProgramList = async (req: Request, res: Response) => {
  const query = req.query as unknown as ProgramListQuery;
  res.json(await getProgramList((req as AuthRequest).user!, query));
};

export const handleCreateProgram = async (req: Request, res: Response) => {
  res.status(201).json(await createProgram(req.body as CreateProgramInput));
};

export const handleUpdateProgram = async (req: Request, res: Response) => {
  res.json(await updateProgram(
    req.params.programId,
    req.body as UpdateProgramInput,
    (req as AuthRequest).user!,
  ));
};

export const handleSetProgramCycles = async (req: Request, res: Response) => {
  const { cycleIds } = req.body as SetProgramCyclesInput;
  res.json(await setProgramCycles(req.params.programId, cycleIds, (req as AuthRequest).user!));
};
