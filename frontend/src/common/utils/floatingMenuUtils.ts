/**
 * Returns all menuitem elements inside a menu container.
 * Used by useFloatingMenu (focus management) and FloatingMenuPanel (keyboard nav).
 */
export function getMenuItems(menuEl: HTMLElement | null): HTMLElement[] {
  if (!menuEl) return [];
  return Array.from(menuEl.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]'));
}
