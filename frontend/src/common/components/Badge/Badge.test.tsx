import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import Badge from './Badge';

it('combines shared badge styling with caller appearance and content', () => {
  render(<Badge className="example-type">Guest Speaker</Badge>);
  expect(screen.getByText('Guest Speaker')).toHaveClass('badge', 'example-type');
});
