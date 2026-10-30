import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`checklists share form and filter styling at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('Checklist/FormAndFilter');
    const form = component.getByRole('group', { name: 'Assigned cycles' });
    const spring = form.getByRole('checkbox', { name: 'Spring 2026' });

    await spring.focus();
    await page.keyboard.press('Space');
    await expect(spring).toBeChecked();
    await expect(form.locator('.checklist-option').first()).toHaveCSS('display', 'flex');
    const formStyle = await form.locator('.checklist-indicator').first().evaluate(element => ({
      size: getComputedStyle(element).width,
      color: getComputedStyle(element).backgroundColor,
    }));

    await component.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('menuitem', { name: 'Cycle' }).click();
    const menu = page.getByRole('group', { name: 'Cycle', exact: true });
    await expect(menu.locator('.checklist-option').first()).toHaveCSS('display', 'flex');
    expect(await menu.locator('.checklist-indicator').first().evaluate(element => ({
      size: getComputedStyle(element).width,
      color: getComputedStyle(element).backgroundColor,
    }))).toEqual(formStyle);

    await page.getByRole('menuitemcheckbox', { name: 'Fall 2026' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Spring 2026' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Spring 2026' })).toHaveAttribute('aria-checked', 'true');
  });
}
