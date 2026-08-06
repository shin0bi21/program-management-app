import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getPreference, setPreference } from '../services/preferenceService';
import type { PreferenceKey, SetPreferenceInput } from '../validation/preferenceSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetPreference = async (req: Request, res: Response) => {
  res.json(await getPreference(actor(req).userId, req.params.preferenceKey as PreferenceKey));
};

export const handleSetPreference = async (req: Request, res: Response) => {
  res.json(await setPreference(
    actor(req).userId,
    req.params.preferenceKey as PreferenceKey,
    req.body as SetPreferenceInput,
  ));
};
