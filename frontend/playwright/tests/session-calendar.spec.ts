import { expect, test } from '@playwright/test';

const sessionStory = 'pages/Programming/Sessions/components/SessionCalendar/SessionItem/SessionItem';

test('anchors session actions after horizontal scrolling and invokes the correct action', async ({ page, mount }) => {
  const component = await mount(`${sessionStory}/InteractiveSessionItem`);
  const item = component.getByRole('button', { name: /Communication.*Open actions/ });
  const viewport = component.getByLabel('Browser-tested session calendar');
  await viewport.evaluate(element => { element.scrollLeft += 35; });
  await item.scrollIntoViewIfNeeded();
  await item.click();

  const menu = page.locator('.calendar-item-menu');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveText(['Edit', 'Delete']);
  await expect.poll(async () => {
    const anchor = await item.boundingBox();
    const bounds = await menu.boundingBox();
    return anchor && bounds ? Math.abs(bounds.x - anchor.x) : Infinity;
  }).toBeLessThanOrEqual(1);
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await expect(component.getByTestId('session-action')).toHaveValue('edit');
  await expect(menu).toBeHidden();

  await item.click();
  await expect(menu).toBeVisible();
  const initialScroll = await viewport.evaluate(element => element.scrollLeft);
  await viewport.evaluate(element => new Promise<void>(resolve => {
    element.addEventListener('scroll', () => resolve(), { once: true });
    element.scrollLeft += 25;
  }));
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).not.toBe(initialScroll);
  await expect(menu).toBeHidden();
});

test('keeps session actions inside a narrow viewport and flips above a bottom-edge session', async ({ page, mount }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  const component = await mount(`${sessionStory}/EdgeSessionItem`);
  const item = component.getByRole('button', { name: /Communication.*Open actions/ });
  await item.click();
  const menu = page.locator('.calendar-item-menu');
  await expect(menu).toBeVisible();
  await expect.poll(async () => {
    const anchor = await item.boundingBox();
    const bounds = await menu.boundingBox();
    return Boolean(anchor && bounds && bounds.x >= 0 && bounds.y >= 0
      && bounds.x + bounds.width <= 390 && bounds.y + bounds.height <= anchor.y);
  }).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(item).toBeFocused();
});

test('keeps actions below the session when selecting it changes the overview height', async ({ page, mount }) => {
  const component = await mount(`${sessionStory}/SelectingSessionItem`);
  const item = component.getByRole('button', { name: /Communication.*Open actions/ });
  const summaryBefore = await item.evaluate(element => {
    const item = element.getBoundingClientRect();
    const summary = element.querySelector('.summary')!.getBoundingClientRect();
    return { left: summary.left - item.left, top: summary.top - item.top, width: item.width, height: item.height };
  });
  await item.click();

  expect(await item.evaluate(element => {
    const item = element.getBoundingClientRect();
    const summary = element.querySelector('.summary')!.getBoundingClientRect();
    return { left: summary.left - item.left, top: summary.top - item.top, width: item.width, height: item.height };
  })).toEqual(summaryBefore);
  await expect(item).toHaveCSS('border-top-width', '1px');

  const menu = page.locator('.calendar-item-menu');
  await expect(menu).toBeVisible();
  await expect.poll(async () => {
    const anchor = await item.boundingBox();
    const bounds = await menu.boundingBox();
    return anchor && bounds ? Math.abs(bounds.y - (anchor.y + anchor.height + 4)) : Infinity;
  }).toBeLessThanOrEqual(1);
});
