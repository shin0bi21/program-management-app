import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createLead, getLeads, signUpLead, updateLead, updateLeadStatus } from '../services/leadService';
import { leadQuerySchema, type CreateLeadInput, type UpdateLeadInput, type UpdateLeadStatusInput } from '../validation/leadSchemas';

export const handleGetLeads = async (req: Request, res: Response) => {
  const filters = leadQuerySchema.shape.query.parse(req.query);
  res.json(await getLeads(filters));
};

export const handleCreateLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createLead(req.body as CreateLeadInput, actorId));
};

export const handleUpdateLeadStatus = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadStatus(req.params.id, req.body as UpdateLeadStatusInput, actorId));
};

export const handleUpdateLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLead(req.params.id, req.body as UpdateLeadInput, actorId));
};

export const handleSignUpLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await signUpLead(req.params.id, actorId));
};
