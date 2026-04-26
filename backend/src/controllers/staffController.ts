import { Request, Response } from 'express';
import { getStaff, createStaff } from '../services/staffService';

export const handleGetStaff = async (req: Request, res: Response) => {
  res.json(await getStaff());
};

export const handleCreateStaff = async (req: Request, res: Response) => {
  const staff = await createStaff(req.body);
  res.status(201).json(staff);
};
