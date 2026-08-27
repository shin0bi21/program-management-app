// This suite owns TaskCalendar browser integration with TimelineCalendar and TaskItem.
import { expect, test, type Locator, type Page } from '@playwright/test';

const taskItemStoryId = 'pages/Staff/Tasks/components/TaskCalendar/TaskItem/TaskItem/InteractiveTaskItem';
const periodWidth = 145;

async function expectPreviewClippedToCalendar(component: Locator, page: Page) {
  const viewport = component.locator('.timeline-calendar > .body');
  const host = page.locator('.timeline-calendar-portal');
  await expect(host).toBeVisible();
  await expect(host).toHaveCSS('overflow', 'hidden');
  const viewportBox = await viewport.boundingBox();
  const hostBox = await host.boundingBox();
  if (!viewportBox || !hostBox) throw new Error('Calendar preview geometry is unavailable');
  expect(hostBox.x).toBeCloseTo(viewportBox.x, 0);
  expect(hostBox.y).toBeCloseTo(viewportBox.y, 0);
  expect(hostBox.width).toBeCloseTo(viewportBox.width, 0);
  expect(hostBox.height).toBeCloseTo(viewportBox.height, 0);
}

test('opens the task-item floating menu instead of editing directly', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const itemBox = await item.boundingBox();
  const row = item.locator('xpath=ancestor::div[contains(@class, "row")]');
  if (!itemBox) throw new Error('Task action anchor geometry is unavailable');
  const pointerX = itemBox.x + itemBox.width * .65;
  const dayIndex = await row.locator('.cell').evaluateAll((cells, x) => cells.findIndex(cell => {
    const bounds = cell.getBoundingClientRect();
    return x >= bounds.left && x < bounds.right;
  }), pointerX);
  const dayBox = await row.locator('.cell').nth(dayIndex).boundingBox();
  if (!dayBox) throw new Error('Task action day geometry is unavailable');
  const borderColor = await item.evaluate(element => getComputedStyle(element).borderTopColor);

  await page.mouse.click(pointerX, itemBox.y + itemBox.height / 2);
  await expect(item).toHaveCSS('border-top-width', '2px');
  await expect(item).toHaveCSS('border-top-color', borderColor);
  await expect(page.getByRole('menuitem', { name: 'View details' })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Set Completed' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await expect.poll(async () => (await page.locator('.calendar-item-menu').boundingBox())?.x)
    .toBeCloseTo(Math.max(dayBox.x, itemBox.x), 0);
  await expect(component.getByTestId('task-item-action')).toHaveValue('');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(component.getByTestId('task-item-action')).toHaveValue('edit');
});

test('anchors task details to the hovered period and dismisses them before movement', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const rangeItem = item.locator('xpath=ancestor::div[contains(@class, "positioned-item")]');
  const row = rangeItem.locator('xpath=ancestor::div[contains(@class, "row")]');
  const itemBox = await item.boundingBox();
  if (!itemBox) throw new Error('Task detail anchor geometry is unavailable');
  const pointerX = itemBox.x + itemBox.width * .2;
  const day = row.locator('.cell').evaluateAll((cells, x) => {
    const index = cells.findIndex(cell => {
      const bounds = cell.getBoundingClientRect();
      return x >= bounds.left && x < bounds.right;
    });
    if (index < 0) throw new Error('Hovered task day is unavailable');
    return index;
  }, pointerX);
  const hoveredDay = row.locator('.cell').nth(await day);
  const dayBox = await hoveredDay.boundingBox();
  if (!dayBox) throw new Error('Hovered task day geometry is unavailable');

  await page.mouse.move(pointerX, itemBox.y + itemBox.height / 2);
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Prepare workshop');
  await expect(tooltip).toContainText('Planning / Prep');
  await expect(tooltip).toContainText('Soft Skills');
  await expect(tooltip).toContainText('Logged');
  await expect(tooltip).toContainText('1.5 hours');
  await expect(tooltip).toContainText('Prepare activities and materials.');
  await expect.poll(async () => {
    const bounds = await tooltip.boundingBox();
    return bounds ? bounds.y + bounds.height <= await page.evaluate(() => window.innerHeight) : false;
  }).toBe(true);
  await expect.poll(async () => (await tooltip.boundingBox())?.x).toBeCloseTo(Math.max(dayBox.x, itemBox.x), 0);
  await expect.poll(async () => (await tooltip.boundingBox())?.y).toBeCloseTo(itemBox.y + itemBox.height + 8, 0);
  const lockedPosition = await tooltip.boundingBox();
  await page.mouse.move(itemBox.x + itemBox.width * .8, itemBox.y + itemBox.height / 2);
  expect((await tooltip.boundingBox())?.x).toBeCloseTo(lockedPosition?.x ?? 0, 0);

  await page.mouse.down();
  await expect(tooltip).toBeHidden();
  await page.mouse.move(itemBox.x + itemBox.width / 2 + periodWidth, itemBox.y + itemBox.height / 2, { steps: 5 });
  await expect(tooltip).toBeHidden();
  await page.mouse.up();
});

test('shows a geometry-only resize preview for a task item', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const viewport = component.getByLabel('Browser-tested task calendar');
  await viewport.evaluate(element => { element.scrollLeft -= 304; });
  const handle = component.getByRole('button', { name: 'Resize start of task-1' });
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "positioned-item")]');
  await expect(wrapper).toHaveClass(/item/);
  await expect(wrapper).toHaveClass(/draggable/);
  await expect(wrapper).toHaveClass(/resizable/);
  await expect.poll(() => item.evaluate(element => getComputedStyle(element).cursor)).toBe('grab');
  await expect.poll(() => handle.evaluate(element => getComputedStyle(element).cursor)).toBe('ew-resize');
  await item.hover();
  const dragHoverBorder = await item.evaluate(element => getComputedStyle(element).borderColor);
  await handle.hover();
  await expect.poll(() => item.evaluate(element => getComputedStyle(element).borderColor)).toBe(dragHoverBorder);
  const box = await handle.boundingBox();
  const original = await wrapper.boundingBox();
  if (!box || !original) throw new Error('Task resize geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - periodWidth + 1, box.y + box.height / 2, { steps: 5 });
  const preview = page.locator('.timeline-calendar-portal .item-resize-preview');
  await expect(preview).toBeVisible();
  await expect.poll(() => viewport.evaluate(element => getComputedStyle(element).cursor)).toBe('ew-resize');
  await expect(preview.getByText('Prepare workshop')).toBeHidden();
  await expect.poll(async () => (await preview.boundingBox())?.width ?? 0).toBeGreaterThan(original.width);
  await expectPreviewClippedToCalendar(component, page);
  await page.mouse.up();

  await expect(page.locator('.timeline-calendar-portal .item-preview')).toHaveCount(0);
  await expect(page.locator('.timeline-calendar-portal')).toHaveCount(0);
  await expect(component.getByTestId('task-range-change')).toHaveValue('resize:2026-08-08:2026-08-11');
});
