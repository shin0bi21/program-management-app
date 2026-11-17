import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import {
  revokeAccountInvite,
  setAccount,
  toggleAccountStatus,
} from '../services/accounts/accountService';
import { listAccounts } from '../services/accounts/accountListService';
import type { AccountQuery } from '../validation/accountSchemas';

export const handleGetAccounts = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  const filters = req.query as unknown as AccountQuery;
  res.json(await listAccounts(user, filters));
};

export const handleSetAccount = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.status(201).json(await setAccount(req.body, user));
};

export const handleRevokeAccountInvite = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  await revokeAccountInvite(req.params.id, user);
  res.status(200).json({ message: 'Account invitation successfully revoked' });
};

export const handleToggleAccountStatus = async (req: Request, res: Response) => {
  const user = (req as AuthRequest).user!;
  res.json(await toggleAccountStatus(req.params.id, user));
};
