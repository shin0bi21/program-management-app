import { Request, Response } from 'express';
import { getSchools, setSchool, deleteSchool } from '../services/youth/youthSchoolService';
import type { AuthRequest } from '../middleware/authMiddleware';
import type { SetSchoolInput } from '../validation/schoolSchemas';

export const handleGetSchools = async (req: Request, res: Response) => {
  res.json(await getSchools());
};

export const handleSetSchool = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const school = await setSchool(req.body as SetSchoolInput, actorId);
  res.json(school);
};

export const handleDeleteSchool = async (req: Request, res: Response) => {
  await deleteSchool(req.params.id);
  res.json({ success: true });
};
