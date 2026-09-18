import Button from '../../../../../common/components/Button/Button';
import ProgramCard from './ProgramCard/ProgramCard';
import type { HomepageProgram } from '../../types';

type ProgrammingSectionProps = {
  programs: HomepageProgram[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export default function ProgrammingSection({
  programs,
  loading = false,
  error = null,
  onRetry,
}: ProgrammingSectionProps) {
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
            <span>Programming couldn’t load.</span>
            {onRetry && (
              <Button size="sm" variant="secondary" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        )}
        <div className="program-grid" aria-busy={loading}>
          {loading ? (
            <p className="program-empty" role="status">Loading programs…</p>
          ) : programs.length ? programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
            />
          )) : !error ? (
            <p className="program-empty">No programs available.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
