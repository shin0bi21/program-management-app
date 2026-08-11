import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Button from '../../../../components/Button/Button';
import LoadingSpinner from '../../../../components/LoadingSpinner/LoadingSpinner';
import Modal from '../../../../components/Modal/Modal';
import { getCohortYouthReportPdf } from '../../api/programming.api';
import './YouthReportModal.css';

interface ReportCohort {
  id: string;
  name: string;
  programName: string;
}

interface YouthReportModalProps {
  cohort: ReportCohort;
  youthId?: string;
  onClose: () => void;
}

export default function YouthReportModal({ cohort, youthId, onClose }: YouthReportModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const reportPdf = useQuery({
    queryKey: ['cohorts', cohort.id, 'reports', 'youth', 'pdf', youthId ?? 'all'],
    queryFn: ({ signal }) => getCohortYouthReportPdf(cohort.id, { youthId }, { signal }),
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
