export function formatCompactPersonName(firstName: string, lastName: string) {
  const lastInitial = lastName.trim().charAt(0);
  return lastInitial ? `${firstName} ${lastInitial}.` : firstName;
}
