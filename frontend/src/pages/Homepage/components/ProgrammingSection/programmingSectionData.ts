import type { Program } from './ProgramCard/programCardSchema'

export const programs: Program[] = [
  {
    age: 'All Ages',
    day: 'Every other Friday',
    copy: 'Welcome to hang out, play video games and board games. A relaxed, open space for youth to connect and unwind.',
    sessions: [
      { date: new Date(2026, 6, 10), topic: 'Drop-in Day' },
      { date: new Date(2026, 6, 24), topic: 'Drop-in Day' },
      // { date: new Date(2026, 7, 7), topic: 'Drop-in Day' },
    ],
    dropIn: true,
  },
  {
    age: 'Ages 12–15',
    title: 'Soft Skills Program',
    day: 'Every Tuesday',
    copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
    sessions: [
      { date: new Date(2026, 6, 7), topic: 'Self-Esteem Workshop' },
      { date: new Date(2026, 6, 14), topic: 'Healthy Habits Guest Speaker' },
      // { date: new Date(2026, 6, 21), topic: 'Confidence Building Workshop' },
      // { date: new Date(2026, 6, 28), topic: 'Self-Estem Trip to Pixel Room' },
    ],
  },
  {
    age: 'Ages 16–19',
    title: 'Job Readiness Program',
    day: 'Every Wednesday',
    copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
    sessions: [
      { date: new Date(2026, 7, 5), topic: 'Guest Speaker - Tradesperson' },
    ],
  },
]
