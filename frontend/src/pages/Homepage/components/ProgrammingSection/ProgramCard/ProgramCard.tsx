import type { HomepageSession } from '../../../api/homepage.api';
import type { Program } from './programCardSchema';

const weekdayFormatter = new Intl.DateTimeFormat('en-CA', { weekday: 'long' });
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

  const [next, ...following] = sessions;

  if (!next) {
    return (
      <p className="program-empty">
        {dropIn ? 'No upcoming drop-in days scheduled.' : 'No upcoming sessions scheduled.'}
      </p>
    );
  }

  const nextDate = new Date(next.startsAt);
  const nextDays = daysUntil(next.startsAt);

  return (
    <>
      <div className="next-session" aria-label={dropIn ? 'Next drop-in day' : 'Next session'}>
        <div className="next-session-date">
          <span className="next-session-day">{nextDate.getDate()}</span>
          <span className="next-session-month">{monthFormatter.format(nextDate)}</span>
        </div>
        <div className="next-session-body">
          <span className="next-session-tag">
            {nextDays === 0 ? 'Today' : nextDays === 1 ? 'Tomorrow' : `In ${nextDays} days`}
          </span>
          <p className="next-session-topic">{dropIn ? 'Drop-in Day' : next.theme || next.programName}</p>
          <p className="next-session-weekday">{weekdayFormatter.format(nextDate)}</p>
        </div>
      </div>
      {following.length > 0 && (
        <ul className="upcoming-rows">
          {following.map((session) => {
            const date = new Date(session.startsAt);
            return (
              <li key={session.id} className="upcoming-row">
                <span className="upcoming-row-date">
                  <strong>{date.getDate()}</strong>
                  <span>{monthFormatter.format(date)}</span>
                </span>
                <span className="upcoming-row-topic">
                  {dropIn ? 'Drop-in Day' : session.theme || session.programName}
                </span>
                <span className="upcoming-row-weekday">{weekdayFormatter.format(date)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
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
