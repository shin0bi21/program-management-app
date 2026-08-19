// Scope: verifies session-type presentation modifiers and supported appearances.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SessionTypeBadge from './SessionTypeBadge';

describe('SessionTypeBadge', () => {
  it.each([
    ['Guest Speaker', 'guest-speaker'],
    ['Field Trip', 'field-trip'],
    ['Workshop', 'regular'],
  ])('maps %s to its visual modifier', (name, modifier) => {
    render(<SessionTypeBadge name={name} />);

    expect(screen.getByText(name)).toHaveClass(
      'session-type-badge--table',
      `session-type-badge--${modifier}`,
    );
  });

  it('supports the compact calendar appearance', () => {
    render(<SessionTypeBadge name="Guest Speaker" appearance="calendar" />);

    expect(screen.getByText('Guest Speaker')).toHaveClass('session-type-badge--calendar');
  });
});
