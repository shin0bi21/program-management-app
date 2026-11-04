import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { getProgramRosterYouth } from '../services/programming/programCycles/programRosterService';
import { listProgramCycles } from '../services/programming/programCycles/programCycleListService';
import { getProgramCycleYouthReport } from '../services/programming/programCycles/programCycleReportService';
import { renderProgramCycleYouthPdf } from '../reports/programming/programCycles/programCycleYouthPdf';
import type { ProgramCycleQuery, ProgramCycleYouthReportQuery } from '../validation/programmingSchemas';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetProgramCycles = async (req: Request, res: Response) => {
  res.json(await listProgramCycles(actor(req), req.query as unknown as ProgramCycleQuery));
};

export const handleGetProgramRosterYouth = async (req: Request, res: Response) => {
  res.json(await getProgramRosterYouth(req.params.programId, req.params.cycleId, actor(req)));
};

export const handleGetProgramCycleYouthReport = async (req: Request, res: Response) => {
  const { youthId } = req.query as unknown as ProgramCycleYouthReportQuery;
  res.json(await getProgramCycleYouthReport(req.params.programId, req.params.cycleId, actor(req), youthId));
};

export const handleGetProgramCycleYouthReportPdf = async (req: Request, res: Response) => {
  const { youthId } = req.query as unknown as ProgramCycleYouthReportQuery;
  const report = await getProgramCycleYouthReport(req.params.programId, req.params.cycleId, actor(req), youthId);
  const pdf = await renderProgramCycleYouthPdf(report);
  const fallbackFilename = pdf.filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '-') || 'Youth Report.pdf';

  res.type('application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
};
