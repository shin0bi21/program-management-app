import './DetailCards.css';
import { formatShortDate } from '../../utils/date';

interface PrimaryContactCardProps {
  contact: {
    firstName?: string | null;
    lastName?: string | null;
    phoneNumber?: string | null;
    relationship?: string | null;
  } | null;
  emptyMessage?: string;
}

const relationshipLabel = (value?: string | null) => value
  ? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ')
  : '—';

export function PrimaryContactCard({ contact, emptyMessage = 'Select a row to view the primary contact.' }: PrimaryContactCardProps) {
  return (
    <section className="detail-card">
      <h2>Primary Contact</h2>
      <div className="detail-card__content">
        {!contact ? <p className="detail-card__empty">{emptyMessage}</p> : <dl>
          <div><dt>Name</dt><dd>{[contact.firstName, contact.lastName].filter(Boolean).join(' ') || '—'}</dd></div>
          <div><dt>Phone</dt><dd>{contact.phoneNumber || '—'}</dd></div>
          <div><dt>Relationship</dt><dd>{relationshipLabel(contact.relationship)}</dd></div>
        </dl>}
      </div>
    </section>
  );
}

export function NotesCard({ notes, selected }: { notes?: string | null; selected: boolean }) {
  return (
    <section className="detail-card">
      <h2>Notes</h2>
      <div className="detail-card__content">
        <p className={!selected || !notes?.trim() ? 'detail-card__empty' : undefined}>
          {!selected ? 'Select a row to view notes.' : notes?.trim() || 'No notes recorded.'}
        </p>
      </div>
    </section>
  );
}

export function AttendanceCard({
  cohorts,
  selected,
}: {
  cohorts?: Array<{
    id: string;
    name: string;
    presentCount: number;
    lateCount: number;
    absentCount: number;
    lastAttendedOn: string | null;
  }>;
  selected: boolean;
}) {
  return (
    <section className="detail-card">
      <h2>Attendance</h2>
      <div className="detail-card__content">
        {!selected || !cohorts?.length ? (
          <p className="detail-card__empty">
            {!selected ? 'Select a row to view attendance.' : 'No attendance recorded.'}
          </p>
        ) : (
          <div className="attendance-card__cohorts">
            {cohorts.map(cohort => (
              <div className="attendance-card__cohort" key={cohort.id}>
                <strong>{cohort.name}</strong>
                <p className="attendance-card__breakdown">
                  Present {cohort.presentCount}
                  <span aria-hidden="true"> · </span>
                  Late {cohort.lateCount}
                  <span aria-hidden="true"> · </span>
                  Absent {cohort.absentCount}
                </p>
                <p className={!cohort.lastAttendedOn ? 'detail-card__empty' : undefined}>
                  Last attended: {cohort.lastAttendedOn
                    ? formatShortDate(cohort.lastAttendedOn)
                    : 'Not recorded'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
