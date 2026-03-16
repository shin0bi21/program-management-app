import { Request, Response } from 'express';
import { getSchools } from '../services/schoolService';

export const handleGetSchools = async (req: Request, res: Response) => {
  try {
    res.json(await getSchools());
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch schools' });
  }
};
