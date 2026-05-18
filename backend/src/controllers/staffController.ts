import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getStaff, setStaff } from '../services/staffService';

export const handleGetStaff = async (req: Request, res: Response) => {
  res.json(await getStaff());
};

export const handleSetStaff = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const staff = await setStaff(req.body, userId);
  res.status(201).json(staff);
};
