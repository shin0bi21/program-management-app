import ViewFileModal from '../ViewFileModal/ViewFileModal';
import useViewFileModal from '../ViewFileModal/hooks/useViewFileModal';

import { getProgramCycleYouthReportPdf } from './youthReport.api';

interface ReportProgramCycle {
  programId: string;
  cycleId: string;
  cycleName: string;
  programName: string;
}

interface YouthReportModalProps {
  programCycle: ReportProgramCycle;
  youthId?: string;
  onClose: () => void;
}

export default function YouthReportModal({ programCycle, youthId, onClose }: YouthReportModalProps) {
  const filename = `${programCycle.programName} - ${programCycle.cycleName} Youth Report.pdf`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const viewFileModal = useViewFileModal({
    isOpen: true,
    requestKey: `${programCycle.programId}:${programCycle.cycleId}:${youthId ?? 'all'}`,
    title: `${programCycle.cycleName} Youth Report`,
    maxWidth: '1100px',
    mimeType: 'application/pdf',
    downloadName: filename,
    downloadLabel: 'Download PDF',
    onClose,
    loadFile: signal => getProgramCycleYouthReportPdf(programCycle, { youthId }, { signal }),
    formatLoadError: () => 'Could not load the youth report.',
  });

  return <ViewFileModal {...viewFileModal} />;
}
