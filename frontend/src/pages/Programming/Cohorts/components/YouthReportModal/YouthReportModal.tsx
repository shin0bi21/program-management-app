import { lazy, Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../common/components/Button/Button';
import LoadingSpinner from '../../../../../common/components/LoadingSpinner/LoadingSpinner';
import Modal from '../../../../../common/components/Modal/Modal';
import { getCohortYouthReport } from '../../../../../common/features/programming/api/programming.api';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import './YouthReportModal.css';

const YouthReportPdf = lazy(() => import('./YouthReportPdf'));

interface YouthReportModalProps {
  cohort: ProgramCohort;
  onClose: () => void;
}

export default function YouthReportModal({ cohort, onClose }: YouthReportModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const report = useQuery({
    queryKey: ['cohorts', cohort?.id, 'reports', 'youth'],
    queryFn: ({ signal }) => getCohortYouthReport(cohort.id, { signal }),
    refetchOnMount: 'always',
  });

  const filename = `${cohort.programName} - ${cohort.name} Youth Report.pdf`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  return <Modal
    isOpen
    onClose={onClose}
    title={`${cohort.name} Youth Report`}
    maxWidth="1100px"
    footer={<>
      <Button variant="secondary" onClick={onClose}>Close</Button>
      {pdfUrl && <a className="btn youth-report-download" href={pdfUrl} download={filename}>Download PDF</a>}
    </>}
  >
    {report.isLoading && <div className="youth-report-pdf__loading"><LoadingSpinner /><span>Loading report…</span></div>}
    {report.error && <p className="form-error" role="alert">Could not load the youth report.</p>}
    {report.data && <Suspense fallback={<div className="youth-report-pdf__loading"><LoadingSpinner /><span>Generating PDF…</span></div>}>
      <YouthReportPdf report={report.data} onPdfReady={setPdfUrl} />
    </Suspense>}
  </Modal>;
}
