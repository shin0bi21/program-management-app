import { Request, Response } from 'express';
import { submitExpressionOfInterest } from '../services/outreach/expressions/publicService';

export const handleExpressionOfInterest = async (req: Request, res: Response) => {
  await submitExpressionOfInterest(req.body);
  res.status(201).json({ message: 'Expression of interest submitted successfully' });
};
