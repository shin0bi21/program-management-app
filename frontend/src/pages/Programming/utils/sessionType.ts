export const sessionTypeModifier = (name: string) => {
  if (name === 'Guest Speaker') return 'guest-speaker';
  if (name === 'Field Trip') return 'field-trip';
  return 'regular';
};
