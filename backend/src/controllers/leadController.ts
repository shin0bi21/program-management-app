import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createLead, getLeads, updateLeadStatus } from '../services/leadService';
import type { CreateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';

export const handleGetLeads = async (_req: Request, res: Response) => {
  res.json(await getLeads());
};

export const handleCreateLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createLead(req.body as CreateLeadInput, actorId));
};

export const handleUpdateLeadStatus = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadStatus(req.params.id, req.body as UpdateLeadStatusInput, actorId));
};
