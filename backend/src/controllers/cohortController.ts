import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';
import { createCohort, deleteCohort, updateCohort } from '../services/programming/cohorts/cohortService';

import { listCohorts } from '../services/programming/cohorts/cohortListService';

import type { CreateCohortInput, UpdateCohortInput } from '../validation/cohortSchemas';
import type { CohortQuery, CohortYouthReportQuery } from '../validation/cohortSchemas';
import { getCohortYouthReport } from '../services/programming/cohorts/cohortReportService';
import { renderCohortYouthPdf } from '../reports/programming/cohorts/cohortYouthPdf';

const actor = (req: Request) => (req as AuthRequest).user!;

export const handleGetCohorts = async (req: Request, res: Response) => {
  const query = req.query as unknown as CohortQuery;
  res.json(await listCohorts(
    actor(req),
    query,
  ));
};

export const handleGetCohortYouthReport = async (req: Request, res: Response) => {
  const { youthId } = req.query as unknown as CohortYouthReportQuery;
  res.json(await getCohortYouthReport(req.params.cohortId, actor(req), youthId));
};

export const handleGetCohortYouthReportPdf = async (req: Request, res: Response) => {
  const { youthId } = req.query as unknown as CohortYouthReportQuery;
  const report = await getCohortYouthReport(req.params.cohortId, actor(req), youthId);
  const pdf = await renderCohortYouthPdf(report);
  const fallbackFilename = pdf.filename.normalize('NFKD').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '-') || 'Youth Report.pdf';

  res.type('application/pdf');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeURIComponent(pdf.filename)}`);
  res.send(pdf.buffer);
};

export const handleCreateCohort = async (req: Request, res: Response) => {
  res.status(201).json(await createCohort(req.body as CreateCohortInput, actor(req)));
};

export const handleUpdateCohort = async (req: Request, res: Response) => {
  res.json(await updateCohort(req.params.cohortId, req.body as UpdateCohortInput, actor(req)));
};

export const handleDeleteCohort = async (req: Request, res: Response) => {
  await deleteCohort(req.params.cohortId, actor(req));
  res.json({ id: req.params.cohortId });
};
