import ViewFileModal from '../../../../components/ViewFileModal/ViewFileModal';
import useViewFileModal from '../../../../components/ViewFileModal/hooks/useViewFileModal';

import { getCohortYouthReportPdf } from '../../api/cohorts.api';

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
  const filename = `${cohort.programName} - ${cohort.name} Youth Report.pdf`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const viewFileModal = useViewFileModal({
    isOpen: true,
    requestKey: `${cohort.id}:${youthId ?? 'all'}`,
    title: `${cohort.name} Youth Report`,
    maxWidth: '1100px',
    mimeType: 'application/pdf',
    downloadName: filename,
    downloadLabel: 'Download PDF',
    onClose,
    loadFile: signal => getCohortYouthReportPdf(cohort.id, { youthId }, { signal }),
    formatLoadError: () => 'Could not load the youth report.',
  });

  return <ViewFileModal {...viewFileModal} />;
}
