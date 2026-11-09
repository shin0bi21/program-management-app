import { useEffect, useState, type ReactNode } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faPen } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../../../common/components/Button/Button';
import { DashboardCard } from '../../../../../common/components/DashboardCard/DashboardCard';
import ViewAttendanceModal from '../../../../../common/features/Attendance/ViewAttendanceModal';
import YouthAttendanceModal from '../../YouthAttendanceModal/YouthAttendanceModal';
import type { YouthAttendanceResult } from '../../YouthAttendanceModal/youthAttendance.api';
import type { YouthProfile } from '../../../types';
import useYouthAttendanceData from './hooks/useYouthAttendanceData';
import './YouthAttendanceDashboardCard.css';

interface AttendanceTarget {
  type: 'edit' | 'report';
  youthId: string;
  programId: string;
  cycleId: string;
}

/**
 * Loads complete active-cycle attendance and shares it with its editor and PDF report.
 * @param props - Selected youth ID/loaded row, action permissions and saved-attendance callback.
 * @example <YouthAttendanceDashboardCard youthId={selectedProfileId} youth={selectedProfile} onSaved={reconcileAttendance} />
 */
export default function YouthAttendanceDashboardCard({
  youthId,
  youth = null,
  canManage = false,
  canViewReport = false,
  onSaved,
}: {
  youthId: string | null;
  youth?: YouthProfile | null;
  canManage?: boolean;
  canViewReport?: boolean;
  onSaved?: (result: YouthAttendanceResult) => void | Promise<void>;
}) {
  const { attendance: data, loading, error, retry } = useYouthAttendanceData(youthId);
  const [target, setTarget] = useState<AttendanceTarget | null>(null);
  const programCycle = data?.programCycle;
  const participant = data?.youth.find(person => person.id === youthId);
  const attendance = programCycle && participant ? { programCycle, sessions: participant.sessions } : null;
  const programId = programCycle?.programId;
  const cycleId = programCycle?.cycleId;
  const targetMatches = target?.youthId === youthId
    && target?.programId === programId && target?.cycleId === cycleId;
  const isEditorOpen = targetMatches && target?.type === 'edit';
  const isReportOpen = targetMatches && target?.type === 'report';

  // A different youth or active cycle ends the previous interaction.
  useEffect(() => setTarget(null), [youthId, programId, cycleId]);

  /** Opens an interaction using the already-loaded active cycle. @example open('edit') */
  const open = (type: AttendanceTarget['type']) => {
    if (!youthId || !programCycle) return;
    setTarget({ type, youthId, programId: programCycle.programId, cycleId: programCycle.cycleId });
  };
  /** Unmounts the active editor or report. @example close() */
  const close = () => setTarget(null);

  let content: ReactNode = null;
  if (error) {
    content = <div role="alert">
      <p>{error}</p>
      <Button size="sm" onClick={() => { void retry(); }}>Retry</Button>
    </div>;
  } else if (programCycle) {
    content = <div className="attendance-card__cohort">
      <div className="attendance-card__cohort-header">
        <span>{programCycle.program} · {programCycle.cycle}</span>
        <div className="attendance-card__actions">
          {canViewReport && <Button size="sm" variant="ghost" className="attendance-card__view"
            aria-label={`View attendance report for ${programCycle.program} · ${programCycle.cycle}`}
            disabled={!youth} onClick={() => open('report')}>
            <FontAwesomeIcon icon={faEye} />
          </Button>}
          {canManage && onSaved && <Button size="sm" variant="ghost" className="attendance-card__manage"
            aria-label={`Manage attendance for ${programCycle.program} · ${programCycle.cycle}`}
            disabled={!youth} onClick={() => open('edit')}>
            <FontAwesomeIcon icon={faPen} />
          </Button>}
        </div>
      </div>
      <p className="attendance-card__breakdown">Present {participant?.presentCount}<span aria-hidden="true"> · </span>
        Late {participant?.lateCount}<span aria-hidden="true"> · </span>Absent {participant?.absentCount}</p>
    </div>;
  }

  return <>
    <DashboardCard title="Attendance" loading={loading} loadingLabel="Loading attendance…"
      emptyMessage={youthId ? 'Not enrolled.' : 'Select a row to view attendance.'}>
      {content}
    </DashboardCard>
    {isEditorOpen && youth && attendance && onSaved && <YouthAttendanceModal
      youth={youth} attendance={attendance} refresh={retry} onClose={close} onSaved={onSaved} />}
    {isReportOpen && data && <ViewAttendanceModal data={data} onClose={close} />}
  </>;
}
