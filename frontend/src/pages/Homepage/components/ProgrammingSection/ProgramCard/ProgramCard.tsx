import type { Program, ProgramSession } from './programCardSchema'

type SessionWithStatus = ProgramSession & {
  status: 'past' | 'today' | 'upcoming'
}

type UpcomingSessionsProps = {
  upcoming: SessionWithStatus[]
  nextDays: number | null
  dropIn?: boolean
}

type ProgramCardProps = {
  program: Program
}

const TODAY = new Date()
TODAY.setHours(0, 0, 0, 0)

const MS_PER_DAY = 1000 * 60 * 60 * 24
const WEEKDAY_FMT = new Intl.DateTimeFormat('en-US', { weekday: 'long' })
const MONTH_FMT = new Intl.DateTimeFormat('en-US', { month: 'short' })

function sessionStatus(date: Date): SessionWithStatus['status'] {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  if (normalized < TODAY) return 'past'
  if (normalized.getTime() === TODAY.getTime()) return 'today'
  return 'upcoming'
}

function daysUntil(date: Date): number {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return Math.round((normalized.getTime() - TODAY.getTime()) / MS_PER_DAY)
}

function UpcomingSessions({ upcoming, nextDays, dropIn }: UpcomingSessionsProps) {
  const next = upcoming[0] ?? null
  const following = upcoming.slice(1)

  if (upcoming.length === 0) {
    return (
      <p className="program-empty">
        {dropIn ? 'No upcoming drop-in days scheduled.' : 'All sessions complete for this cycle.'}
      </p>
    )
  }

  return (
    <>
      <div className="next-session" aria-label={dropIn ? 'Next drop-in day' : 'Next session'}>
        <div className="next-session-date">
          <span className="next-session-day">{next!.date.getDate()}</span>
          <span className="next-session-month">{MONTH_FMT.format(next!.date)}</span>
        </div>
        <div className="next-session-body">
          <span className="next-session-tag">
            {nextDays === 0 ? 'Today' : nextDays === 1 ? 'Tomorrow' : `In ${nextDays} days`}
          </span>
          <p className="next-session-topic">{dropIn ? 'Drop-in Day' : next!.topic}</p>
          <p className="next-session-weekday">{WEEKDAY_FMT.format(next!.date)}</p>
        </div>
      </div>
      {following.length > 0 && (
        <ul className="upcoming-rows">
          {following.map((session) => (
            <li key={session.date.toISOString()} className="upcoming-row">
              <span className="upcoming-row-date">
                <strong>{session.date.getDate()}</strong>
                <span>{MONTH_FMT.format(session.date)}</span>
              </span>
              <span className="upcoming-row-topic">{dropIn ? 'Drop-in Day' : session.topic}</span>
              <span className="upcoming-row-weekday">{WEEKDAY_FMT.format(session.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

export default function ProgramCard({ program }: ProgramCardProps) {
  const sessionsWithStatus = program.sessions.map((session) => ({
    ...session,
    status: sessionStatus(session.date),
  }))
  const upcoming = sessionsWithStatus.filter((session) => session.status !== 'past')
  const nextDays = upcoming[0] ? daysUntil(upcoming[0].date) : null

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
        <UpcomingSessions upcoming={upcoming} nextDays={nextDays} dropIn={program.dropIn} />
      </div>
    </article>
  )
}
