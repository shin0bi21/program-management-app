import type { HomepageProgram, HomepageSession } from '../../../types';

const monthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const millisecondsPerDay = 86_400_000;

function daysUntil(startsAt: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(startsAt);
  sessionDate.setHours(0, 0, 0, 0);
  return Math.round((sessionDate.getTime() - today.getTime()) / millisecondsPerDay);
}

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
        const date = new Date(session.startsAt);
        const days = daysUntil(session.startsAt);
        return (
          <li
            key={session.id}
            className={`next-session${index === 0 ? ' next-session--featured' : ''}`}
          >
            <time className="next-session-date" dateTime={session.startsAt}>
              <span className="next-session-day">{date.getDate()}</span>
              <span className="next-session-month">{monthFormatter.format(date)}</span>
            </time>
            <div className="next-session-body">
              <p className="next-session-topic">{dropIn ? 'Drop-in Day' : session.theme}</p>
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

interface ProgramCardProps {
  program: HomepageProgram;
}

function formatAgeRange(minAge: number | null, maxAge: number | null) {
  if (minAge === null || maxAge === null) return 'All Ages';
  if (minAge === maxAge) return `Age ${minAge}`;
  return `Ages ${minAge}–${maxAge}`;
}

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
