import ViewFileModal from '../ViewFileModal/ViewFileModal';
import useViewFileModal from '../ViewFileModal/hooks/useViewFileModal';

import { getAttendanceReportPdf, type AttendanceGroup } from './attendance.api';

interface ViewAttendanceModalProps {
  data: AttendanceGroup;
  onClose: () => void;
}

/**
 * Renders and previews the complete attendance supplied by its opening dashboard.
 * @param props - Loaded cycle attendance and the callback clearing the report target.
 * @example <ViewAttendanceModal data={attendance} onClose={closeReport} />
 */
export default function ViewAttendanceModal({ data, onClose }: ViewAttendanceModalProps) {
  const { programCycle } = data;
  const filename = `${programCycle.program} - ${programCycle.cycle} Attendance Report.pdf`
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

  const viewFileModal = useViewFileModal({
    requestKey: `${programCycle.programId}:${programCycle.cycleId}`,
    title: `${programCycle.cycle} Attendance Report`,
    maxWidth: '1100px',
    mimeType: 'application/pdf',
    downloadName: filename,
    downloadLabel: 'Download PDF',
    onClose,
    loadFile: signal => getAttendanceReportPdf(data, { signal }),
    formatLoadError: () => 'Could not load attendance report.',
  });

  return <ViewFileModal {...viewFileModal} />;
}
