import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  getAccounts,
  revokeAccountInvite,
  setAccount,
  toggleAccountStatus,
} from '../services/accountService';
import type { AccountQuery } from '../validation/accountSchemas';

export const handleGetAccounts = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  const filters = req.query as unknown as AccountQuery;
  res.json(await getAccounts(actor, filters));
};

export const handleSetAccount = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.status(201).json(await setAccount(req.body, actor));
};

export const handleRevokeAccountInvite = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  await revokeAccountInvite(req.params.id, actor);
  res.status(200).json({ message: 'Account invitation successfully revoked' });
};

export const handleToggleAccountStatus = async (req: Request, res: Response) => {
  const actor = (req as AuthRequest).user!;
  res.json(await toggleAccountStatus(req.params.id, actor));
};
