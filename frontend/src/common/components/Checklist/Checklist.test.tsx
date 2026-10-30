import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import Checklist from './Checklist';

const options = [{ value: 'fall', label: 'Fall 2026' }, { value: 'spring', label: 'Spring 2026' }];

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
