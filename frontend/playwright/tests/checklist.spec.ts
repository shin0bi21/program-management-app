import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`supports form and filter keyboard selection at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('Checklist/FormAndFilter');
    const form = component.getByRole('group', { name: 'Assigned cycles' });
    const spring = form.getByRole('checkbox', { name: 'Spring 2026' });

    await expect(form).toHaveCSS('max-height', '240px');
    await expect(form).toHaveCSS('overflow-y', 'auto');
    await spring.focus();
    await page.keyboard.press('Space');
    await expect(spring).toBeChecked();

    await component.getByRole('button', { name: 'Filters' }).click();
    await page.getByRole('menuitem', { name: 'Cycle' }).click();
    await page.getByRole('menuitemcheckbox', { name: 'Fall 2026' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Spring 2026' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('menuitemcheckbox', { name: 'Spring 2026' })).toHaveAttribute('aria-checked', 'true');
  });

  test(`wraps long form labels and keeps a long youth list keyboard accessible at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('SessionYouthChecklist/LongRoster');
    const checklist = component.getByRole('group', { name: 'Link youth' }).last();
    const first = checklist.getByRole('checkbox').first();
    const last = checklist.getByRole('checkbox').last();

    await expect(checklist).toHaveCSS('max-height', '240px');
    const geometry = await checklist.evaluate(element => ({
      height: element.getBoundingClientRect().height,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.height).toBeLessThanOrEqual(240);
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight);
    expect(geometry.scrollWidth).toBe(geometry.clientWidth);

    await first.focus();
    await expect(first.locator('..')).toHaveCSS('outline-style', 'solid');
    await expect(first.locator('..')).toHaveCSS('outline-offset', '-2px');
    await page.keyboard.press('Space');
    await expect(first).toBeChecked();

    for (let index = 1; index < 20; index += 1) await page.keyboard.press('Tab');
    await expect(last).toBeFocused();
    const listBox = await checklist.boundingBox();
    const lastBox = await last.boundingBox();
    expect(lastBox!.y).toBeGreaterThanOrEqual(listBox!.y);
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(listBox!.y + listBox!.height);
    await page.keyboard.press('Space');
    await expect(last).toBeChecked();
  });
}
