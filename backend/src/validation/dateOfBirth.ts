import { calendarDateSchema } from './dateRangeValidation';

const torontoDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit',
});

export const dateOfBirthSchema = calendarDateSchema('Date of birth').refine(
  dateOfBirth => dateOfBirth < torontoDate.format(new Date()),
  'Date of birth must be before today',
);
