import type { SubmitStatus } from '../../../../../common/hooks/useSubmitStatus';

interface EmptyMessageOptions {
  availableCount: number;
  unenrolledCount: number;
  ageFilterEnabled: boolean;
  hasAgeRange: boolean;
  minAge: number | null;
  maxAge: number | null;
}

export function getEnrollmentStatusMessage(
  status: SubmitStatus,
  error: string | null,
  selectedCount: number,
  cohortLabel: string,
) {
  if (status === 'submitting') {
    return `Adding ${selectedCount} youth to ${cohortLabel}...`;
  }
  if (status === 'success') {
    return error ?? `${selectedCount} youth successfully added to ${cohortLabel}.`;
  }
  return error ?? undefined;
}

export function getEnrollmentEmptyMessage({
  availableCount,
  unenrolledCount,
  ageFilterEnabled,
  hasAgeRange,
  minAge,
  maxAge,
}: EmptyMessageOptions) {
  if (availableCount) return 'No youth match your search.';
  if (ageFilterEnabled && hasAgeRange && unenrolledCount) {
    return `No available youth are ages ${minAge}–${maxAge}. Choose “All ages” to make an exception.`;
  }
  return 'All youth are already enrolled.';
}
