import { Request, Response } from 'express';
import { getYouth, setYouth } from '../services/youthService';

export const handleGetYouth = async (req: Request, res: Response) => {
  const id = req.query.id as string | undefined;
  res.json(await getYouth(id));
};

export const handleSetYouth = async (req: Request, res: Response) => {
  const { id } = req.body;
  const saved = await setYouth(req.body);
  res.status(id ? 200 : 201).json(saved);
};
