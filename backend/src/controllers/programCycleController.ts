import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getProgramRosterYouth } from '../services/programming/programCycles/programRosterService';
import { listProgramCycles } from '../services/programming/programCycles/programCycleListService';
import { getProgramCycleAttendance } from '../services/attendanceService';
import { renderAttendanceReportPdf } from '../reports/attendanceReportPdf';
import { assertProgramCycleAccess } from '../policies/programAccessPolicy';
import type { ProgramCycleQuery, AttendanceReportInput } from '../validation/programmingSchemas';

/**
 * Returns the authenticated actor for the scoped program operation.
 * @param req - Request already accepted by authentication middleware.
 * @example actor(req).userId // signed-in account ID
 */
const actor = (req: Request) => (req as AuthRequest).user!;

/**
 * Lists program-cycle assignments using validated filters.
 * @param req - Authenticated request with parsed program-cycle filters.
 * @param res - Receives the actor's visible assignments.
 * @example handleGetProgramCycles(req, res)
 */
export const handleGetProgramCycles = async (req: Request, res: Response) => {
  res.json(await listProgramCycles(actor(req), req.query as unknown as ProgramCycleQuery));
};

/**
 * Returns the authorized assignment's youth roster.
 * @param req - Authenticated request identifying a program-cycle assignment.
 * @param res - Receives the assignment's youth roster.
 * @example handleGetProgramRosterYouth(req, res)
 */
export const handleGetProgramRosterYouth = async (req: Request, res: Response) => {
  res.json(await getProgramRosterYouth(req.params.programId, req.params.cycleId, actor(req)));
};

/**
 * Returns full attendance for the validated cycle.
 * @param req - Authenticated cycle request.
 * @param res - Receives the complete attendance data consumed by dashboards and reports.
 * @example handleGetProgramCycleAttendance(req, res)
 */
export const handleGetProgramCycleAttendance = async (req: Request, res: Response) => {
  res.json(await getProgramCycleAttendance(req.params.programId, req.params.cycleId, actor(req)));
};

/**
 * Renders the dashboard's supplied attendance data as a PDF.
 * @param req - Validated program-cycle request with complete loaded attendance in its body.
 * @param res - Receives the PDF with private caching and its download filename.
 * @example handleGetAttendanceReportPdf(req, res) // renders without another attendance read
 */
export const handleGetAttendanceReportPdf = async (req: Request, res: Response) => {
  await assertProgramCycleAccess(actor(req), req.params.programId, req.params.cycleId);
  const pdf = await renderAttendanceReportPdf(req.body as AttendanceReportInput);
  const fallbackFilename = pdf.filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '-') || 'Attendance Report.pdf';

  res.type('application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
};
