import ProgramCard from './ProgramCard/ProgramCard'
import { programs } from './programmingSectionData'

export default function ProgrammingSection() {
  return (
    <section id="programming" className="offerings-section" aria-labelledby="offerings-title">
      <div className="section-inner">
        <div className="section-heading">
          <h2 id="offerings-title" className="section-title">Programming</h2>
        </div>
        <div className="program-grid">
          {programs.map((program) => (
            <ProgramCard key={program.age} program={program} />
          ))}
        </div>
      </div>
    </section>
  )
}
