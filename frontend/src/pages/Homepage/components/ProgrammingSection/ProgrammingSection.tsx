import ProgramCard from './ProgramCard/ProgramCard';
import type { HomepageSession } from '../../api/homepage.api';
import { programs } from './programmingSectionData';

export default function ProgrammingSection({ sessions }: { sessions: HomepageSession[] }) {
  return (
    <section id="programming" className="offerings-section" aria-labelledby="offerings-title">
      <div className="section-inner">
        <div className="section-heading">
          <h2 id="offerings-title" className="section-title">
            Programming
          </h2>
        </div>
        <div className="program-grid">
          {programs.map((program) => (
            <ProgramCard
              key={program.programName}
              program={program}
              sessions={sessions.filter((session) => session.programName === program.programName)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
