import { expect, test, type Locator, type Page } from '@playwright/test';

const storyId = 'ResourceCalendar/Interactive';

async function drag(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Drag source or target is not visible');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

test('virtualizes a large staff list while preserving sticky headers', async ({ mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const rows = component.locator('.resource-calendar__row');
  const header = component.locator('.resource-calendar__header');
  const initialHeaderTop = (await header.boundingBox())?.y;

  expect(await rows.count()).toBeLessThan(60);
  expect(await rows.count()).toBeGreaterThan(0);
  await viewport.evaluate(element => element.scrollTo({ top: element.scrollHeight }));

  await expect(component.getByText('Staff 60')).toBeVisible();
  await expect(component.getByText('Staff 1')).toBeHidden();
  expect((await header.boundingBox())?.y).toBeCloseTo(initialHeaderTop ?? 0, 0);
});

test('keeps the resource column sticky during real horizontal scrolling', async ({ mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const resource = component.getByText('Staff 1', { exact: true });
  const initialLeft = (await resource.boundingBox())?.x;

  await viewport.evaluate(element => element.scrollTo({ left: element.scrollWidth }));

  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect((await resource.boundingBox())?.x).toBeCloseTo(initialLeft ?? 0, 0);
});

test('moves an item to a valid day and records the drop', async ({ page, mount }) => {
  const component = await mount(storyId);
  const source = component.getByRole('button', { name: 'Movable entry' });
  const target = component.locator('[data-resource-id="staff-1"][data-period="2026-08-10"]');

  await drag(page, source, target);

  await expect(component.getByTestId('drop-record')).toHaveValue('staff-1:2026-08-09->staff-1:2026-08-10');
  await expect(target.getByRole('button', { name: 'Movable entry' })).toBeVisible();
  await expect(page.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('rejects a cross-resource drop and always removes the drag overlay', async ({ page, mount }) => {
  const component = await mount(storyId);
  const sourceCell = component.locator('[data-resource-id="staff-1"][data-period="2026-08-09"]');
  const target = component.locator('[data-resource-id="staff-2"][data-period="2026-08-10"]');

  await drag(page, sourceCell.getByRole('button', { name: 'Movable entry' }), target);

  await expect(component.getByTestId('drop-record')).toHaveValue('');
  await expect(sourceCell.getByRole('button', { name: 'Movable entry' })).toBeVisible();
  await expect(page.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('auto-scrolls horizontally while dragging near the viewport edge', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const source = component.getByRole('button', { name: 'Movable entry' });
  const sourceBox = await source.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!sourceBox || !viewportBox) throw new Error('Calendar geometry is unavailable');
  const initialScrollLeft = await viewport.evaluate(element => element.scrollLeft);

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + viewportBox.width - 8, sourceBox.y + sourceBox.height / 2, { steps: 8 });
  await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialScrollLeft);
  await page.mouse.up();

  await expect(page.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('opens the overflow panel and supports keyboard dismissal', async ({ page, mount }) => {
  const component = await mount(storyId);

  await component.getByRole('button', { name: 'Show all 3 items for 2026-08-09' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overflow one' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});
