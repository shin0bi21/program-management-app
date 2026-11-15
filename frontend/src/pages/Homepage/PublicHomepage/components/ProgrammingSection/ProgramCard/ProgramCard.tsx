import { Temporal } from 'temporal-polyfill';
import { getDate } from '../../../../../../common/utils/date';
import type { HomepageProgram, HomepageSession } from '../../../types';

interface ProgramCardProps {
  program: HomepageProgram;
}

/**
 * Displays one public program with its age range and upcoming Session dates.
 * @example <ProgramCard program={program} /> // program description and upcoming days
 */
export default function ProgramCard({ program }: ProgramCardProps) {
  const dropIn = !program.enrollmentRequired;

  return (
    <article className="program-card">
      <header className="program-card-head">
        <h3 className="program-title">{program.name}</h3>
        <p className="program-age">{formatAgeRange(program.minAge, program.maxAge)}</p>
      </header>
      <div className="program-copy-block">
        {program.description && <p className="program-copy">{program.description}</p>}
      </div>
      <div className="program-sessions">
        <p className="program-sessions-label">Upcoming</p>
        <UpcomingSessions sessions={program.sessions} dropIn={dropIn} />
      </div>
    </article>
  );
}

/**
 * Formats inclusive age bounds or an unrestricted label when either bound is absent.
 * @example formatAgeRange(12, 15) // 'Ages 12–15'
 */
function formatAgeRange(minAge: number | null, maxAge: number | null) {
  if (minAge === null || maxAge === null) return 'All Ages';
  if (minAge === maxAge) return `Age ${minAge}`;
  return `Ages ${minAge}–${maxAge}`;
}

/**
 * Lists the saved upcoming dates and relative day labels for one program.
 * @param props - Ordered sessions and whether the program uses open attendance.
 * @example <UpcomingSessions sessions={[]} dropIn /> // no upcoming drop-in message
 */
function UpcomingSessions({
  sessions,
  dropIn,
}: {
  sessions: HomepageSession[];
  dropIn?: boolean;
}) {
  const [next] = sessions;

  if (!next) {
    return (
      <p className="program-empty">
        {dropIn ? 'No upcoming drop-in days scheduled.' : 'No upcoming sessions scheduled.'}
      </p>
    );
  }

  return (
    <ul className="upcoming-rows" aria-label={dropIn ? 'Upcoming drop-in days' : 'Upcoming sessions'}>
      {sessions.map((session, index) => {
        const date = Temporal.PlainDate.from(session.date);
        const days = daysUntil(session.date);
        return (
          <li
            key={session.id}
            className={`next-session${index === 0 ? ' next-session--featured' : ''}`}
          >
            <time className="next-session-date" dateTime={session.date}>
              <span className="next-session-day">{date.day}</span>
              <span className="next-session-month">{date.toLocaleString('en-CA', { month: 'short' })}</span>
            </time>
            <div className="next-session-body">
              <p className="next-session-topic">{dropIn ? 'Drop-in Day' : session.title}</p>
              <span className="next-session-tag">
                {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Counts calendar days from local today to the saved Session date.
 * @param date - Saved YYYY-MM-DD business date.
 * @example On November 10, daysUntil('2026-11-11') returns 1.
 */
function daysUntil(date: string) {
  return Temporal.PlainDate.from(getDate()).until(date).days;
}
