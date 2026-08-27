import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createLead, deleteLead, getLeads, signUpLead, updateLead, updateLeadStatus } from '../services/outreach/leads/leadService';
import { createLeadNote, getLeadNotes, updateLeadNoteDetails } from '../services/outreach/leads/leadNoteService';
import type { CreateLeadInput, LeadQuery, SignUpLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';
import type { SetLeadNoteInput, UpdateLeadNoteInput } from '../validation/leadNoteSchemas';

export const handleGetLeads = async (req: Request, res: Response) => {
  const filters = req.query as unknown as LeadQuery;
  res.json(await getLeads(filters));
};

export const handleCreateLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createLead(req.body as CreateLeadInput, actorId));
};

export const handleUpdateLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLead(req.params.id, req.body as UpdateLeadInput, actorId));
};

export const handleUpdateLeadStatus = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadStatus(req.params.id, req.body as UpdateLeadStatusInput, actorId));
};

export const handleSignUpLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await signUpLead(req.params.id, req.body as SignUpLeadInput, actorId));
};

export const handleDeleteLead = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await deleteLead(req.params.id, actorId));
};

export const handleGetLeadNotes = async (req: Request, res: Response) => {
  res.json(await getLeadNotes(req.params.id));
};

export const handleSetLeadNote = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createLeadNote(req.params.id, req.body as SetLeadNoteInput, actorId));
};

export const handleUpdateLeadNote = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadNoteDetails(
    req.params.id,
    req.params.noteId,
    req.body as UpdateLeadNoteInput,
    actorId,
  ));
};
