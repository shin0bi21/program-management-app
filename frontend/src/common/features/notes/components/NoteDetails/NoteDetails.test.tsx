// Owns shared note metadata, optional context and details, and nested content presentation.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NoteDetails from './NoteDetails';

describe('NoteDetails', () => {
  it('renders complete metadata, context, details, and nested content', () => {
    render(
      <NoteDetails
        categoryBadge={<span>Health</span>}
        createdAt="2026-08-19T12:00:00.000Z"
        createdByName="Admin User"
        context={<span>Summer cohort</span>}
        details="Keep an epinephrine injector nearby."
      >
        <span>Linked record</span>
      </NoteDetails>,
    );

    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('Aug 19, 2026')).toBeInTheDocument();
    expect(screen.getByText('Summer cohort').closest('div')).toHaveClass('note-details__context');
    expect(screen.getByText('Keep an epinephrine injector nearby.').closest('div')).toHaveClass(
      'note-details__body',
    );
    expect(screen.getByText('Linked record')).toBeInTheDocument();
  });

  it('uses the staff fallback and omits absent optional regions', () => {
    const { container } = render(
      <NoteDetails
        categoryBadge={<span>General</span>}
        createdAt="2026-08-19T12:00:00.000Z"
        createdByName={null}
      />,
    );

    expect(screen.getByText('Staff')).toBeInTheDocument();
    expect(container.querySelector('.note-details__context')).not.toBeInTheDocument();
    expect(container.querySelector('.note-details__body')).not.toBeInTheDocument();
  });
});
