import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { deleteLead, setLead, signUpLead, updateLeadStatus } from '../services/outreach/leads/leadService';
import { getLeads } from '../services/outreach/leads/leadListService';
import { createLeadNote, deleteLeadNote, getLeadNotes, updateLeadNoteDetails } from '../services/outreach/leads/leadNoteService';
import type { CreateLeadInput, LeadQuery, SignUpLeadInput, UpdateLeadInput, UpdateLeadStatusInput } from '../validation/leadSchemas';
import type { SetLeadNoteInput, UpdateLeadNoteInput } from '../validation/leadNoteSchemas';

/**
 * Returns matching leads.
 * @example handleGetLeads(req, res)
 */
export const handleGetLeads = async (req: Request, res: Response) => {
  const filters = req.query as unknown as LeadQuery;
  res.json(await getLeads(filters));
};

/**
 * Creates an internal lead.
 * @example handleCreateLead(req, res)
 */
export const handleCreateLead = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.status(201).json(await setLead(req.body as CreateLeadInput, userId));
};

/**
 * Updates a lead's intake details.
 * @example handleUpdateLead(req, res)
 */
export const handleUpdateLead = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await setLead(req.body as UpdateLeadInput, userId, req.params.id));
};

/**
 * Updates a lead's follow-up status.
 * @example handleUpdateLeadStatus(req, res)
 */
export const handleUpdateLeadStatus = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadStatus(req.params.id, req.body as UpdateLeadStatusInput, userId));
};

/**
 * Converts a lead to a youth profile.
 * @example handleSignUpLead(req, res)
 */
export const handleSignUpLead = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.status(201).json(await signUpLead(req.params.id, req.body as SignUpLeadInput, user));
};

/**
 * Deletes an unconverted lead.
 * @example handleDeleteLead(req, res)
 */
export const handleDeleteLead = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await deleteLead(req.params.id, userId));
};

/**
 * Returns a lead's notes.
 * @example handleGetLeadNotes(req, res)
 */
export const handleGetLeadNotes = async (req: Request, res: Response) => {
  res.json(await getLeadNotes(req.params.id));
};

/**
 * Creates a lead note.
 * @example handleSetLeadNote(req, res)
 */
export const handleSetLeadNote = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.status(201).json(await createLeadNote(req.params.id, req.body as SetLeadNoteInput, userId));
};

/**
 * Updates a lead note.
 * @example handleUpdateLeadNote(req, res)
 */
export const handleUpdateLeadNote = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await updateLeadNoteDetails(
    req.params.id,
    req.params.noteId,
    req.body as UpdateLeadNoteInput,
    userId,
  ));
};

/**
 * Deletes a lead note.
 * @example handleDeleteLeadNote(req, res)
 */
export const handleDeleteLeadNote = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user!.userId;
  res.json(await deleteLeadNote(req.params.id, req.params.noteId, userId));
};
