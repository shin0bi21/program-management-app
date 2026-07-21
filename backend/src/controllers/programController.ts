import { Request, Response } from 'express';
import { createProgram, getPrograms } from '../services/programService';
import type { CreateProgramInput } from '../validation/programSchemas';

export const handleGetPrograms = async (_req: Request, res: Response) => {
  res.json(await getPrograms());
};

export const handleCreateProgram = async (req: Request, res: Response) => {
  res.status(201).json(await createProgram(req.body as CreateProgramInput));
};
