import ViewFileModal from '../ViewFileModal/ViewFileModal';
import useViewFileModal from '../ViewFileModal/hooks/useViewFileModal';

import { getProgramCycleYouthReportPdf } from './youthReport.api';

interface ReportProgramCycle {
  programId: string;
  cycleId: string;
  cycle: string;
  program: string;
}

interface YouthReportModalProps {
  programCycle: ReportProgramCycle;
  youthId?: string;
  onClose: () => void;
}

/**
 * Loads and previews a report for the supplied program/cycle and optional youth.
 * The opening view mounts this interaction and unmounts it on close, cancelling its load.
 * @param props - Report selection and the callback that clears the opening view's target.
 * @example <YouthReportModal programCycle={assignment} youthId={youth.id} onClose={closeReport} />
 */
export default function YouthReportModal({ programCycle, youthId, onClose }: YouthReportModalProps) {
  const filename = `${programCycle.program} - ${programCycle.cycle} Youth Report.pdf`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const viewFileModal = useViewFileModal({
    requestKey: `${programCycle.programId}:${programCycle.cycleId}:${youthId ?? 'all'}`,
    title: `${programCycle.cycle} Youth Report`,
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
