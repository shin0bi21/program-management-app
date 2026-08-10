import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../../common/components/Button/Button';
import LoadingSpinner from '../../../../../common/components/LoadingSpinner/LoadingSpinner';
import Modal from '../../../../../common/components/Modal/Modal';
import { getCohortYouthReportPdf } from '../../../../../common/features/programming/api/programming.api';
import type { ProgramCohort } from '../../../../../common/types/cohort';
import './YouthReportModal.css';

interface YouthReportModalProps {
  cohort: ProgramCohort;
  onClose: () => void;
}

export default function YouthReportModal({ cohort, onClose }: YouthReportModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const reportPdf = useQuery({
    queryKey: ['cohorts', cohort.id, 'reports', 'youth', 'pdf'],
    queryFn: ({ signal }) => getCohortYouthReportPdf(cohort.id, { signal }),
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (!reportPdf.data) {
      setPdfUrl(null);
      return undefined;
    }
    const objectUrl = URL.createObjectURL(reportPdf.data);
    setPdfUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setPdfUrl(null);
    };
  }, [reportPdf.data]);

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
    {reportPdf.isLoading && <div className="youth-report-pdf__loading"><LoadingSpinner /><span>Generating report…</span></div>}
    {reportPdf.error && <p className="form-error" role="alert">Could not load the youth report.</p>}
    {pdfUrl && <div className="youth-report-pdf"><iframe
      className="youth-report-pdf__viewer"
      src={pdfUrl}
      title="Youth report PDF preview"
    /></div>}
  </Modal>;
}
