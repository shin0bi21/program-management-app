import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import OpenAttendancePicker from './OpenAttendancePicker';

const youth = Array.from({ length: 60 }, (_, index) => ({
  id: `youth-${index + 1}`,
  firstName: 'Person',
  lastName: String(index + 1),
}));

it('wires the complete youth list and current attendance into a searchable dynamic checklist', () => {
  const onToggle = vi.fn();
  render(<OpenAttendancePicker youth={youth} selectedYouthIds={['youth-1']}
    loading={false} unavailable={false} disabled={false} onToggle={onToggle} />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(25);
  expect(screen.getByRole('checkbox', { name: /^Person 1$/ })).toBeChecked();

  fireEvent.change(screen.getByRole('searchbox', { name: 'Search Youth attendance' }), {
    target: { value: 'Person 60' },
  });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Person 60' }));
  expect(onToggle).toHaveBeenCalledWith('youth-60');
});

it('distinguishes loading, unavailable, and successful empty lists', () => {
  const props = { youth: [], selectedYouthIds: [], disabled: false, onToggle: vi.fn() };
  const view = render(<OpenAttendancePicker {...props} loading unavailable={false} />);
  expect(screen.getByText('Loading youth…')).toBeInTheDocument();

  view.rerender(<OpenAttendancePicker {...props} loading={false} unavailable />);
  expect(screen.queryByText('No youth profiles available.')).not.toBeInTheDocument();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();

  view.rerender(<OpenAttendancePicker {...props} loading={false} unavailable={false} />);
  expect(screen.getByText('No youth profiles available.')).toBeInTheDocument();
});

it('locks search and choices while saving', () => {
  render(<OpenAttendancePicker youth={youth} selectedYouthIds={[]}
    loading={false} unavailable={false} disabled onToggle={vi.fn()} />);

  expect(screen.getByRole('searchbox')).toBeDisabled();
  expect(screen.getAllByRole('checkbox').every(checkbox => checkbox.hasAttribute('disabled'))).toBe(true);
});
