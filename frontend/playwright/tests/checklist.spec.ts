import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`supports form and filter keyboard selection at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('Checklist/FormAndFilter');
    const form = component.getByRole('group', { name: 'Assigned cycles' }).last();
    const spring = form.getByRole('checkbox', { name: 'Spring 2026' });

    await expect(form.locator('.checklist-items')).toHaveCSS('max-height', '400px');
    await expect(form.locator('.checklist-items')).toHaveCSS('overflow-y', 'auto');
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
    const checklist = component.getByRole('group', { name: 'Link youth' }).last().locator('.checklist-items');
    const first = checklist.getByRole('checkbox').first();
    const last = checklist.getByRole('checkbox').last();

    await expect(checklist).toHaveCSS('max-height', '400px');
    const geometry = await checklist.evaluate(element => ({
      height: element.getBoundingClientRect().height,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(geometry.height).toBeLessThanOrEqual(400);
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

for (const variant of ['compact', 'form']) {
  test(`fits a smaller container while retaining a separate search field (${variant})`, async ({ mount }) => {
    const component = await mount('Checklist/SearchableDynamic', { variant, containerHeight: 220 });
    const checklist = component.getByRole('group', { name: 'People' });
    const items = checklist.locator('.checklist-items');

    expect((await checklist.boundingBox())!.height).toBeLessThanOrEqual(220);
    expect(await items.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    await expect(checklist.getByRole('searchbox')).toBeVisible();
    await items.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(checklist.getByRole('checkbox')).toHaveCount(50);
  });

  test(`reveals batches while scrolling and keeps search visible (${variant})`, async ({ page, mount }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    const component = await mount('Checklist/SearchableDynamic', { variant });
    const items = component.locator('.checklist-items');
    const search = component.getByRole('searchbox', { name: 'Search People' });
    await expect(component.getByRole('checkbox')).toHaveCount(25);
    const searchTop = (await search.boundingBox())!.y;

    await items.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(component.getByRole('checkbox')).toHaveCount(50);
    await items.evaluate(element => { element.scrollTop = element.scrollHeight; });
    await expect(component.getByRole('checkbox')).toHaveCount(63);
    expect((await search.boundingBox())!.y).toBe(searchTop);

    await search.fill('PERSON 63');
    await expect(component.getByRole('checkbox')).toHaveCount(1);
    await component.getByRole('checkbox', { name: 'Person 63' }).check();
    await search.fill('');
    await expect(component.getByRole('checkbox')).toHaveCount(25);
    expect(await items.evaluate(element => element.scrollTop)).toBe(0);

    await search.fill('Person 63');
    await expect(component.getByRole('checkbox', { name: 'Person 63' })).toBeChecked();
  });

  test(`reaches later batches using only the keyboard (${variant})`, async ({ page, mount }) => {
    const component = await mount('Checklist/SearchableDynamic', { variant });
    await component.getByRole('checkbox', { name: 'Person 1', exact: true }).focus();

    for (let index = 1; index < 63; index += 1) await page.keyboard.press('Tab');
    const last = component.getByRole('checkbox', { name: 'Person 63' });
    await expect(last).toBeFocused();
    await page.keyboard.press('Space');
    await expect(last).toBeChecked();
  });
}
