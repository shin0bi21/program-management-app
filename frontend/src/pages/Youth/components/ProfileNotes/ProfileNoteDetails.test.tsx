// Owns profile-note detail metadata and domain category labeling.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { YouthProfileNote } from '../../../../common/types/youth';
import ProfileNoteDetails from './ProfileNoteDetails';

const note: YouthProfileNote = {
  id: 'note-1',
  youthId: 'youth-1',
  category: 'health',
  details: 'Keep an epinephrine injector nearby.',
  createdAt: '2026-08-19T12:00:00.000Z',
  updatedAt: '2026-08-19T12:00:00.000Z',
  createdByName: 'Admin User',
};

describe('ProfileNoteDetails', () => {
  it('maps profile-note metadata into the shared details presentation', () => {
    render(<ProfileNoteDetails note={note} />);

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Keep an epinephrine injector nearby.')).toBeInTheDocument();
  });
});
