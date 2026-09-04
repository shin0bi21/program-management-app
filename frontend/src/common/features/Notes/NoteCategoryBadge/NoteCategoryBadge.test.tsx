import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import NoteCategoryBadge from './NoteCategoryBadge';

describe('NoteCategoryBadge', () => {
  it('renders the supplied label with its category modifier', () => {
    render(<NoteCategoryBadge category="follow_up" label="Follow-up" />);

    expect(screen.getByText('Follow-up')).toHaveClass('note-category', 'note-category--follow_up');
  });
});
