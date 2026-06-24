import { Request, Response } from 'express';
import { submitCohortInterest } from '../services/publicService';

export const handleCohortInterest = async (req: Request, res: Response) => {
  await submitCohortInterest(req.body);
  res.status(201).json({ message: 'Interest form submitted successfully' });
};
