import type { HomepageSession } from '../../../types';
import type { Program } from './programCardSchema';

const monthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const millisecondsPerDay = 86_400_000;

function daysUntil(startsAt: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sessionDate = new Date(startsAt);
  sessionDate.setHours(0, 0, 0, 0);
  return Math.round((sessionDate.getTime() - today.getTime()) / millisecondsPerDay);
}

type SessionsState = 'ready' | 'loading' | 'error';

function UpcomingSessions({
  sessions,
  dropIn,
  state,
}: {
  sessions: HomepageSession[];
  dropIn?: boolean;
  state: SessionsState;
}) {
  if (state === 'loading') return <p className="program-empty">Loading schedule…</p>;
  if (state === 'error') return <p className="program-empty">Schedule unavailable.</p>;

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
  program: Program;
  sessions: HomepageSession[];
  sessionsState?: SessionsState;
}

export default function ProgramCard({ program, sessions, sessionsState = 'ready' }: ProgramCardProps) {
  return (
    <article className="program-card">
      <header className="program-card-head">
        <span className="program-schedule">{program.day}</span>
        <p className="program-age">{program.age}</p>
      </header>
      <div className="program-copy-block">
        <span className="program-copy-label">{program.dropIn ? 'Drop-in Days' : program.title}</span>
        <p className="program-copy">{program.copy}</p>
      </div>
      <div className="program-sessions">
        <p className="program-sessions-label">Upcoming</p>
        <UpcomingSessions sessions={sessions} dropIn={program.dropIn} state={sessionsState} />
      </div>
    </article>
  );
}
