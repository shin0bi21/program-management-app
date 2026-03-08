import { Request, Response } from 'express';
import { getYouth, setYouth } from '../services/youthService';

export const handleGetYouth = async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string | undefined;
    res.json(await getYouth(id));
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: 'Failed to fetch youth profiles' });
  }
};

export const handleSetYouth = async (req: Request, res: Response) => {
  const { id } = req.body;
  try {
    const saved = await setYouth(req.body);
    res.status(id ? 200 : 201).json(saved);
  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error(error);
    }
    res.status(500).json({ error: id ? 'Failed to update youth profile' : 'Failed to create youth profile' });
  }
};
