import { ConflictError } from '../../../errors';

/**
 * Reports overlapping programs and aborted concurrent enrollment transactions as conflicts.
 * Other failures propagate unchanged; concurrency conflicts require retrying the whole command.
 * @param error - Failure from an enrollment, cycle-date, or program-mode transaction.
 * @example rethrowEnrollmentConflict(new Error('Disconnected')) // throws the same error
 */
export function rethrowEnrollmentConflict(error: unknown): never {
  if (error instanceof Error) {
    const databaseError = error as Error & { code?: string; constraint_name?: string };
    const isEnrollmentConflict = databaseError.code === '23P01'
      && databaseError.constraint_name === 'program_enrollments_one_program_per_youth';

    if (isEnrollmentConflict) {
      throw Object.assign(new ConflictError('Youth can only be enrolled in one program at a time'), { cause: error });
    }

    const isConcurrencyConflict = databaseError.code === '40P01' || databaseError.code === '40001';
    if (isConcurrencyConflict) {
      throw Object.assign(new ConflictError('Enrollment changed concurrently. Please try again.'), { cause: error });
    }
  }

  throw error;
}
