import { Request, Response } from 'express';
import { getSchools } from '../services/schoolService';

export const handleGetSchools = async (req: Request, res: Response) => {
  res.json(await getSchools());
};
