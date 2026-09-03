import type { Program } from './ProgramCard/programCardSchema';

export const programs: Program[] = [
  {
    programName: 'Drop In',
    age: 'All Ages',
    day: 'Every other Friday',
    copy: 'Welcome to hang out, play video games and board games. A relaxed, open space for youth to connect and unwind.',
    dropIn: true,
  },
  {
    programName: 'Future Ready',
    age: 'Ages 12–15',
    title: 'Future Ready Program',
    day: 'Every Tuesday',
    copy: 'Youth build soft skills through educational sessions, presentations, hands-on activities, and trips. The focus is on emotion regulation, healthy habits, relationships, and goal-setting that supports consistent school attendance and future pathways.',
  },
  {
    programName: 'Job Readiness',
    age: 'Ages 16–19',
    title: 'Job Readiness Program',
    day: 'Every Wednesday',
    copy: 'Youth receive job-readiness education, interview practice, one-on-one support, volunteer placement experience, and one paid project to strengthen resumes. Program elements also support transitions into post-secondary education and the workforce.',
  },
];
