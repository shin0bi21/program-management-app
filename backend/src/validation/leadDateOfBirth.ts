import { calendarDateSchema, isCalendarDate } from './dateRangeValidation';

const torontoDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Returns completed years on the Toronto date, or null for an invalid birth date. */
export function leadAge(dateOfBirth: string, today = torontoDate.format(new Date())) {
  if (!isCalendarDate(dateOfBirth)) return null;

  const years = Number(today.slice(0, 4)) - Number(dateOfBirth.slice(0, 4));
  return years - (today.slice(5) < dateOfBirth.slice(5) ? 1 : 0);
}

export const leadDateOfBirthSchema = calendarDateSchema('Date of birth').refine(
  dateOfBirth => dateOfBirth <= torontoDate.format(new Date()),
  'Date of birth cannot be in the future',
);
export const leadIntakeDateOfBirthSchema = leadDateOfBirthSchema.refine(dateOfBirth => {
  const age = leadAge(dateOfBirth);
  return age !== null && age >= 12 && age <= 19;
}, 'Date of birth must correspond to an age between 12 and 19');
