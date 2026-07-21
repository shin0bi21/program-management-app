import { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getYouth, setYouth, toggleYouthStatus } from '../services/youthService';
import { inviteYouthAccount } from '../services/accountService';

export const handleGetYouth = async (req: Request, res: Response) => {
  const id = req.query.id as string | undefined;
  res.json(id ? await getYouth(id) : await getYouth());
};

export const handleSetYouth = async (req: Request, res: Response) => {
  const { id, email } = req.body;
  const userId = (req as AuthRequest).user!.userId;
  let saved = await setYouth(req.body, userId);
  if (email && !saved.account) {
    const account = await inviteYouthAccount(saved.id, email, userId);
    saved = { ...saved, account };
  }
  res.status(id ? 200 : 201).json(saved);
};

export const handleToggleYouthStatus = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const youthId = req.params.id;
  const updated = await toggleYouthStatus(youthId, actorId);
  res.json(updated);
};

export const handleInviteYouth = async (req: Request, res: Response) => {
  const actorId = (req as AuthRequest).user!.userId;
  const account = await inviteYouthAccount(req.params.id, req.body.email, actorId);
  res.status(201).json(account);
};
