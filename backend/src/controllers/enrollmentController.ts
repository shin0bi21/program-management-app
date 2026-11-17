import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

import { enrollYouth, withdrawYouth } from '../services/programming/programCycles/enrollmentService';
import { setProgramRoster } from '../services/programming/programCycles/programRosterMutationService';
import type { EnrollYouthInput, SetProgramRosterInput } from '../validation/programmingSchemas';

/**
 * Reads the user established by authentication middleware.
 * @param req - Request after authenticateToken has run.
 * @example user(req).userId // authenticated account ID
 */
const user = (req: Request) => (req as AuthRequest).user!;

/**
 * Enrolls a validated youth batch in the requested assignment.
 * @param req - Authenticated request with assignment IDs and selected youth IDs.
 * @param res - Response receiving created enrollments and affected rows.
 * @example A valid enrollment returns status 201.
 */
export const handleEnrollYouth = async (req: Request, res: Response) => {
  res.status(201).json(await enrollYouth(req.params.programId, req.params.cycleId, req.body as EnrollYouthInput, user(req)));
};

/**
 * Withdraws the requested youth while retaining their attendance history.
 * @param req - Authenticated request with validated assignment and youth IDs.
 * @param res - Response receiving the committed enrollment and affected rows.
 * @example Withdrawal sets the current business date without deleting attendance.
 */
export const handleWithdrawYouth = async (req: Request, res: Response) => {
  res.json(await withdrawYouth(req.params.programId, req.params.cycleId, req.params.youthId, user(req)));
};

/**
 * Saves the submitted roster selection and returns authoritative assignment changes.
 * @param req - Authenticated request with validated assignment IDs and selected youth IDs.
 * @param res - Response receiving the committed roster changes.
 * @example A body of { youthIds: [] } withdraws all current members.
 */
export const handleSetProgramRoster = async (req: Request, res: Response) => {
  res.json(await setProgramRoster(req.params.programId, req.params.cycleId, req.body as SetProgramRosterInput, user(req)));
};
