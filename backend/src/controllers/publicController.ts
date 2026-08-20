import { Request, Response } from 'express';
import { submitPublicLead } from '../services/outreach/leads/publicLeadService';

export const handlePublicLead = async (req: Request, res: Response) => {
  await submitPublicLead(req.body);
  res.status(201).json({ message: 'Lead submitted successfully' });
};
