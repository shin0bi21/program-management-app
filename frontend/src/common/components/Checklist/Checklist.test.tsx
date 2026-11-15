import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import Checklist from './Checklist';

const options = [{ id: 'fall', name: 'Fall 2026' }, { id: 'spring', name: 'Spring 2026' }];

it.each(['compact', 'form'] as const)('renders controlled native checkboxes with keyboard access (%s)', async variant => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const { rerender } = render(<Checklist variant={variant} options={options} value={['fall']} onToggle={onToggle} ariaLabel="Cycles" />);

  expect(screen.getByRole('group', { name: 'Cycles' })).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Fall 2026' })).toBeChecked();
  await user.tab();
  await user.keyboard(' ');
  expect(onToggle).toHaveBeenCalledWith('fall');

  rerender(<Checklist variant={variant} options={options} value={[]} onToggle={onToggle} ariaLabel="Cycles" />);
  expect(screen.getByRole('checkbox', { name: 'Fall 2026' })).not.toBeChecked();
});

it.each([
  { variant: 'compact', inMenu: false },
  { variant: 'compact', inMenu: true },
  { variant: 'form', inMenu: false },
] as const)('disables every choice when locked ($variant, menu: $inMenu)', async ({ variant, inMenu }) => {
  const onToggle = vi.fn();
  render(<Checklist variant={variant} options={options} value={['fall']} onToggle={onToggle} ariaLabel="Cycles" disabled inMenu={inMenu} />);

  for (const option of screen.getAllByRole(inMenu ? 'menuitemcheckbox' : 'checkbox')) {
    expect(option).toBeDisabled();
    await userEvent.click(option);
  }
  expect(onToggle).not.toHaveBeenCalled();
});

it('preserves checkbox menu semantics without submitting a surrounding form', async () => {
  const onToggle = vi.fn();
  const onSubmit = vi.fn(event => event.preventDefault());
  render(<form onSubmit={onSubmit}><div role="menu">
    <Checklist options={options} value={['fall']} onToggle={onToggle} ariaLabel="Cycles" inMenu />
  </div></form>);

  expect(screen.getByRole('menuitemcheckbox', { name: 'Fall 2026' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Spring 2026' }));
  expect(onToggle).toHaveBeenCalledWith('spring');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('filters labels without changing selected values', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(<Checklist options={options} value={['fall']} onToggle={onToggle} ariaLabel="Cycles" search />);
  const search = screen.getByRole('searchbox', { name: 'Search Cycles' });

  await user.type(search, 'SPRING');
  expect(screen.queryByRole('checkbox', { name: 'Fall 2026' })).not.toBeInTheDocument();
  expect(onToggle).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(screen.getByRole('checkbox', { name: 'Fall 2026' })).toBeChecked();
  await user.type(search, 'absent');
  expect(screen.getByRole('status')).toHaveTextContent('No matching items.');
});

it('allows selection of a search result beyond the initial batch', async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const rows = Array.from({ length: 60 }, (_, index) => ({ id: String(index), name: `Person ${index + 1}` }));
  render(<Checklist options={rows} value={[]} onToggle={onToggle} ariaLabel="People" dynamicItems search />);
  expect(screen.getAllByRole('checkbox')).toHaveLength(25);

  await user.type(screen.getByRole('searchbox'), 'Person 60');
  await user.click(screen.getByRole('checkbox', { name: 'Person 60' }));
  expect(onToggle).toHaveBeenCalledWith('59');
});
