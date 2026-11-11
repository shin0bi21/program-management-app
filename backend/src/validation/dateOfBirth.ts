import { calendarDateSchema } from './dateRangeValidation';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit',
});

export const dateOfBirthSchema = calendarDateSchema('Date of birth').refine(
  dateOfBirth => dateOfBirth < dateFormatter.format(new Date()),
  'Date of birth must be before today',
);
