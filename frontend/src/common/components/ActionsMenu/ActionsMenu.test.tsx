import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionsMenu, { type ActionItem } from './ActionsMenu';

function makeItems(): ActionItem[] {
  return [
    { id: 'edit', label: 'Edit', onClick: vi.fn() },
    { id: 'delete', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
  ];
}

describe('ActionsMenu', () => {
  it('uses the supplied accessible trigger label and starts closed', () => {
    render(<ActionsMenu items={makeItems()} ariaLabel="More actions for Jane Doe" />);
    expect(screen.getByRole('button', { name: 'More actions for Jane Doe' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the supplied actions and closes after invoking only the selected handler', () => {
    const items = makeItems();
    render(<ActionsMenu items={items} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(items[0].onClick).toHaveBeenCalledOnce();
    expect(items[1].onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables the trigger and prevents opening when disabled', () => {
    render(<ActionsMenu items={makeItems()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();

    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
