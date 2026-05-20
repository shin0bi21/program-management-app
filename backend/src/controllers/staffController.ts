import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getStaff, setStaff, deleteStaff, toggleStaffStatus } from '../services/staffService';

export const handleGetStaff = async (req: Request, res: Response) => {
  res.json(await getStaff());
};

export const handleSetStaff = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const staff = await setStaff(req.body, userId);
  res.status(201).json(staff);
};

export const handleDeleteStaff = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  const staffId = req.params.id;
  await deleteStaff(staffId, userId);
  res.status(200).json({ message: 'User successfully deleted' });
};

export const handleToggleStaffStatus = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const staffId = req.params.id;
  const updated = await toggleStaffStatus(staffId, actorId);
  res.json(updated);
};
