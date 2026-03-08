import { Request, Response } from 'express';
import { getStaff, createStaff } from '../services/staffService';

export const handleGetStaff = async (req: Request, res: Response) => {
  try {
    res.json(await getStaff());
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
};

export const handleCreateStaff = async (req: Request, res: Response) => {
  try {
    const staff = await createStaff(req.body);
    res.status(201).json(staff);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to create staff user' });
  }
};
