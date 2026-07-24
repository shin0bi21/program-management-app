import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionsMenu, { type ActionItem } from './ActionsMenu';

function makeItems(overrides: Partial<ActionItem>[] = []): ActionItem[] {
  return [
    { id: 'edit', label: 'Edit', onClick: vi.fn(), ...overrides[0] },
    { id: 'delete', label: 'Delete', onClick: vi.fn(), variant: 'danger', ...overrides[1] },
  ];
}

describe('ActionsMenu', () => {
  it('renders the trigger button', () => {
    render(<ActionsMenu items={makeItems()} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('uses the supplied accessible trigger label', () => {
    render(<ActionsMenu items={makeItems()} ariaLabel="More actions for Jane Doe" />);
    expect(screen.getByRole('button', { name: 'More actions for Jane Doe' })).toBeInTheDocument();
  });

  it('does not show the menu initially', () => {
    render(<ActionsMenu items={makeItems()} />);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('shows the menu with all items after clicking the trigger', () => {
    render(<ActionsMenu items={makeItems()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('uses the rendered menu height when placement flips above the trigger', () => {
    const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('floating-menu-panel')) {
        return { top: 0, bottom: 240, left: 0, right: 160, width: 160, height: 240, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      }
      if (this.tagName === 'BUTTON') {
        return { top: 600, bottom: 628, left: 800, right: 828, width: 28, height: 28, x: 800, y: 600, toJSON: () => ({}) } as DOMRect;
      }
      return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    });

    render(<ActionsMenu items={makeItems()} />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('menu')).toHaveStyle({ top: '356px' });
    rectSpy.mockRestore();
  });

  it('calls the item handler when a menu item is clicked', () => {
    const items = makeItems();
    render(<ActionsMenu items={items} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(items[0].onClick).toHaveBeenCalledOnce();
  });

  it('closes the menu after clicking a menu item', () => {
    render(<ActionsMenu items={makeItems()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the menu when Escape is pressed', () => {
    render(<ActionsMenu items={makeItems()} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('toggles the menu closed when the trigger is clicked again', () => {
    render(<ActionsMenu items={makeItems()} />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('disables the trigger button when disabled prop is true', () => {
    render(<ActionsMenu items={makeItems()} disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not open the menu when trigger is disabled', () => {
    render(<ActionsMenu items={makeItems()} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
