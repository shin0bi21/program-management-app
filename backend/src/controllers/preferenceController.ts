import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getPreference, setPreference } from '../services/preferenceService';
import type { PreferenceKey, PreferenceValue } from '../validation/preferenceSchemas';

const user = (req: Request) => (req as AuthRequest).user!;

export const handleGetPreference = async (req: Request, res: Response) => {
  res.json(await getPreference(user(req).userId, req.params.preferenceKey as PreferenceKey));
};

export const handleSetPreference = async (req: Request, res: Response) => {
  res.json(await setPreference(
    user(req).userId,
    req.params.preferenceKey as PreferenceKey,
    req.body as PreferenceValue,
  ));
};
