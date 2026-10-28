import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getCycleReferenceData } from '../services/referenceData/cycleReferenceData';
import { getProgramReferenceData } from '../services/referenceData/programReferenceData';
import { getSchoolReferenceData } from '../services/referenceData/schoolReferenceData';
import { getStaffReferenceData } from '../services/referenceData/staffReferenceData';
import type { ProgramReferenceDataQuery, StaffReferenceFeature } from '../validation/referenceDataSchemas';

export const handleGetCycleReferenceData = async (_req: Request, res: Response) => {
  res.json(await getCycleReferenceData());
};

export const handleGetProgramReferenceData = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  const query = req.query as unknown as ProgramReferenceDataQuery;
  res.json(await getProgramReferenceData(actor, query.assignedOnly));
};

export const handleGetStaffReferenceData = async (req: Request, res: Response) => {
  res.json(await getStaffReferenceData((req as AuthRequest).user!, req.query.feature as StaffReferenceFeature));
};

export const handleGetSchoolReferenceData = async (_req: Request, res: Response) => {
  res.json(await getSchoolReferenceData());
};
