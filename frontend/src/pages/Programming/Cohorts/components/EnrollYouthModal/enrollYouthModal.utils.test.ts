// @vitest-environment node

// Owns enrollment status and empty-state copy selection.
import { describe, expect, it } from 'vitest';

import {
  getEnrollmentEmptyMessage,
  getEnrollmentStatusMessage,
} from './enrollYouthModal.utils';

describe('Enroll Youth modal messages', () => {
  it('describes the active submission state', () => {
    expect(getEnrollmentStatusMessage('submitting', null, 2, 'Soft Skills')).toBe(
      'Adding 2 youth to Soft Skills...',
    );
    expect(getEnrollmentStatusMessage('success', null, 2, 'Soft Skills')).toBe(
      '2 youth successfully added to Soft Skills.',
    );
    expect(getEnrollmentStatusMessage(
      'success',
      'Youth were enrolled, but the roster could not refresh. Reload to see them.',
      2,
      'Soft Skills',
    )).toContain('Reload to see them');
    expect(getEnrollmentStatusMessage('error', 'Enrollment failed', 2, 'Soft Skills')).toBe(
      'Enrollment failed',
    );
  });

  it('distinguishes search, age-filter, and fully enrolled empty states', () => {
    expect(getEnrollmentEmptyMessage({
      availableCount: 1,
      unenrolledCount: 1,
      ageFilterEnabled: true,
      hasAgeRange: true,
      minAge: 12,
      maxAge: 15,
    })).toBe('No youth match your search.');

    expect(getEnrollmentEmptyMessage({
      availableCount: 0,
      unenrolledCount: 1,
      ageFilterEnabled: true,
      hasAgeRange: true,
      minAge: 12,
      maxAge: 15,
    })).toContain('No available youth are ages 12–15');

    expect(getEnrollmentEmptyMessage({
      availableCount: 0,
      unenrolledCount: 0,
      ageFilterEnabled: true,
      hasAgeRange: true,
      minAge: 12,
      maxAge: 15,
    })).toBe('All youth are already enrolled.');
  });
});
