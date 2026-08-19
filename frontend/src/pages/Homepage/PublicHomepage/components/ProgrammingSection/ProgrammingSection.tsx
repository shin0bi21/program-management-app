import Button from '../../../../../common/components/Button/Button';
import ProgramCard from './ProgramCard/ProgramCard';
import type { HomepageSession } from '../../types';
import { programs } from './programmingSectionData';

type ProgrammingSectionProps = {
  sessions: HomepageSession[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function ProgrammingSection({
  sessions,
  loading = false,
  error = null,
  onRetry,
}: ProgrammingSectionProps) {
  const sessionsState = loading ? 'loading' : error ? 'error' : 'ready';

  return (
    <section id="programming" className="offerings-section" aria-labelledby="offerings-title">
      <div className="section-inner">
        <div className="section-heading">
          <h2 id="offerings-title" className="section-title">
            Programming
          </h2>
        </div>
        {error && (
          <div className="programming-request-error" role="alert">
            <span>Upcoming schedules couldn’t load.</span>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
        <div className="program-grid" aria-busy={loading}>
          {programs.map((program) => (
            <ProgramCard
              key={program.programName}
              program={program}
              sessions={sessions.filter((session) => session.programName === program.programName)}
              sessionsState={sessionsState}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
