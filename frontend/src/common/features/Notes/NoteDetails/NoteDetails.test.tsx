import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NoteDetails from './NoteDetails';

describe('NoteDetails', () => {
  it('uses the staff fallback when the author is unavailable', () => {
    render(
      <NoteDetails
        categoryLabel={<span>General</span>}
        createdAt="2026-08-19T12:00:00.000Z"
        createdByName={null}
      />,
    );

    expect(screen.getByText('Staff')).toBeInTheDocument();
  });
});
