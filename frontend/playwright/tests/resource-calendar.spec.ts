import { expect, test, type Locator, type Page } from '@playwright/test';

const storyId = 'ResourceCalendar/Interactive';
const rangeLaneSizingStoryId = 'ResourceCalendar/RangeLaneSizing';
const timeItemStoryId = 'pages/Staff/Timesheets/components/TimeItem/TimeItem/InteractiveTimeItems';
const taskItemStoryId = 'pages/Staff/Tasks/components/TaskItem/TaskItem/InteractiveTaskItem';

async function drag(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Drag source or target is not visible');
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await page.mouse.up();
}

async function expectPreviewClippedToCalendar(component: Locator, page: Page) {
  const viewport = component.locator('.resource-calendar');
  const host = page.locator('.resource-calendar__preview-host');
  await expect(host).toBeVisible();
  await expect(host).toHaveCSS('overflow', 'hidden');
  const viewportBox = await viewport.boundingBox();
  const hostBox = await host.boundingBox();
  if (!viewportBox || !hostBox) throw new Error('Calendar preview clipping geometry is unavailable');
  expect(hostBox.x).toBeCloseTo(viewportBox.x, 0);
  expect(hostBox.y).toBeCloseTo(viewportBox.y, 0);
  expect(hostBox.width).toBeCloseTo(viewportBox.width, 0);
  expect(hostBox.height).toBeCloseTo(viewportBox.height, 0);
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

test('keeps every ranged-item lane the same height', async ({ mount }) => {
  const component = await mount(rangeLaneSizingStoryId);
  const first = component.getByRole('button', { name: 'First ranged task' })
    .locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const second = component.getByRole('button', { name: 'Second ranged task' })
    .locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const firstBox = await first.boundingBox();
  const secondBox = await second.boundingBox();
  if (!firstBox || !secondBox) throw new Error('Range lane geometry is unavailable');

  expect(secondBox.height).toBeCloseTo(firstBox.height, 0);
  expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
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

test('scrolls positioned items with their period cells without per-item updates', async ({ mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Movable entry' }).locator('..');
  const cell = component.locator('[data-resource-id="staff-1"][data-period="2026-08-09"]');
  const initialItemBox = await item.boundingBox();
  const initialCellBox = await cell.boundingBox();
  if (!initialItemBox || !initialCellBox) throw new Error('Calendar geometry is unavailable');

  expect(initialItemBox.x).toBeCloseTo(initialCellBox.x + 7, 0);
  expect(initialItemBox.width).toBeCloseTo(initialCellBox.width - 14, 0);
  await viewport.evaluate(element => { element.scrollLeft += 40; });

  const scrolledItemBox = await item.boundingBox();
  const scrolledCellBox = await cell.boundingBox();
  if (!scrolledItemBox || !scrolledCellBox) throw new Error('Scrolled calendar geometry is unavailable');
  expect(scrolledItemBox.x - initialItemBox.x).toBeCloseTo(scrolledCellBox.x - initialCellBox.x, 0);
});

test('disables vertical overscroll so the period header stays fixed', async ({ mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');

  await expect.poll(() => viewport.evaluate(element => getComputedStyle(element).overscrollBehaviorY)).toBe('none');
});

test('moves an item to a valid day and records the drop', async ({ page, mount }) => {
  const component = await mount(storyId);
  const source = component.getByRole('button', { name: 'Movable entry' });
  const target = component.locator('[data-resource-id="staff-1"][data-period="2026-08-10"]');

  await drag(page, source, target);

  await expect(component.getByTestId('drop-record')).toHaveValue('staff-1:2026-08-09->staff-1:2026-08-10');
  await expect(component.locator(
    '[data-item-resource-id="staff-1"][data-item-period="2026-08-10"]',
  ).getByRole('button', { name: 'Movable entry' })).toBeVisible();
  await expect(page.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('rejects a cross-resource drop and always removes the drag overlay', async ({ page, mount }) => {
  const component = await mount(storyId);
  const sourceSlot = component.locator('[data-item-resource-id="staff-1"][data-item-period="2026-08-09"]');
  const target = component.locator('[data-resource-id="staff-2"][data-period="2026-08-10"]');

  await drag(page, sourceSlot.getByRole('button', { name: 'Movable entry' }), target);

  await expect(component.getByTestId('drop-record')).toHaveValue('');
  await expect(sourceSlot.getByRole('button', { name: 'Movable entry' })).toBeVisible();
  await expect(page.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('hides hover details on pointer down and throughout an active drag', async ({ page, mount }) => {
  const component = await mount(storyId);
  const source = component.getByRole('button', { name: 'Movable entry' });
  const target = component.getByRole('button', { name: 'Target entry' });

  await source.hover();
  await expect(page.getByRole('tooltip', { name: 'Movable entry details' })).toBeVisible();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Drag item geometry is unavailable');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await expect(page.getByRole('tooltip', { name: 'Movable entry details' })).toBeHidden();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await expect(page.getByRole('tooltip', { name: 'Target entry details' })).toBeHidden();

  await page.mouse.up();
});

test('preserves an item control click when movement never crosses the drag threshold', async ({ mount }) => {
  const component = await mount(storyId);

  await component.getByRole('button', { name: 'Movable entry' }).click();

  await expect(component.getByTestId('activation-record')).toHaveValue('movable-entry');
  await expect(component.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('clips a point-item ghost to the same calendar preview host', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Movable entry' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Point drag geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 4 });
  await expect(page.locator('.resource-calendar__drag-overlay')).toBeVisible();
  await expectPreviewClippedToCalendar(component, page);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));

  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
  await expect(component.getByTestId('drop-record')).toHaveValue('');
});

test('cancels point drag without committing its last valid target', async ({ page, mount }) => {
  const component = await mount(storyId);
  const source = component.getByRole('button', { name: 'Movable entry' });
  const target = component.locator('[data-resource-id="staff-1"][data-period="2026-08-10"]');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Point cancellation geometry is unavailable');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 6 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));

  await expect(component.getByTestId('drop-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('resizes a ranged item with real pointer geometry', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const before = await item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]').boundingBox();
  const handleBox = await handle.boundingBox();
  if (!before || !handleBox) throw new Error('Range resize geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 152, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(component.getByTestId('resize-record')).toHaveValue('end:2026-08-08:2026-08-12->2026-08-08:2026-08-13');
  await expect(component.getByTestId('activation-record')).toHaveValue('');
  const after = await item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]').boundingBox();
  expect(after?.width ?? 0).toBeGreaterThan(before.width + 130);
});

test('resizes a ranged item from the keyboard without activating it', async ({ mount }) => {
  const component = await mount(storyId);
  const handle = component.getByRole('button', { name: 'Resize start of ranged-task' });

  await handle.focus();
  await handle.press('ArrowRight');

  await expect(component.getByTestId('resize-record')).toHaveValue('start:2026-08-08:2026-08-12->2026-08-09:2026-08-12');
  await expect(component.getByTestId('activation-record')).toHaveValue('');
});

test('cancels ranged movement and resize without committing', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const itemBox = await item.boundingBox();
  if (!itemBox) throw new Error('Range cancellation geometry is unavailable');

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(itemBox.x + itemBox.width / 2 + 152, itemBox.y + itemBox.height / 2, { steps: 6 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  await expect(component.getByTestId('range-move-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);

  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('Range resize cancellation geometry is unavailable');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 152, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  await expect(component.getByTestId('resize-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('cleans up ranged movement when pointer capture is lost', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const box = await item.boundingBox();
  if (!box) throw new Error('Lost-capture geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await wrapper.dispatchEvent('lostpointercapture', { pointerId: 1 });

  await expect(component.getByTestId('range-move-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('moves a ranged item while preserving its duration and suppressing activation', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Range move geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 152, box.y + box.height / 2, { steps: 6 });
  await expect(page.locator('.resource-calendar__range-preview')).toBeVisible();
  await expectPreviewClippedToCalendar(component, page);
  await page.mouse.up();

  await expect(component.getByTestId('range-move-record')).toHaveValue('staff-3:2026-08-08:2026-08-12->staff-3:2026-08-09:2026-08-13');
  await expect(component.getByTestId('activation-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__range-preview')).toHaveCount(0);
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('lets a ranged ghost follow the pointer freely before snapping on drop', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Range move geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 43, box.y + box.height / 2 + 9, { steps: 4 });
  const previewBox = await page.locator('.resource-calendar__range-preview').boundingBox();
  if (!previewBox) throw new Error('Range preview geometry is unavailable');
  expect(previewBox.x - box.x).toBeCloseTo(43, 0);
  expect(previewBox.y - box.y).toBeGreaterThanOrEqual(7);
  expect(previewBox.y - box.y).toBeLessThanOrEqual(10);
  await page.mouse.up();

  await expect(component.getByTestId('range-move-record')).toHaveValue('');
});

test('moves a ranged item to another resource without changing its dates', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const itemBox = await item.boundingBox();
  const targetBox = await component.locator('.resource-calendar__cell[data-resource-id="staff-2"]').first().boundingBox();
  if (!itemBox || !targetBox) throw new Error('Range reassignment geometry is unavailable');

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(itemBox.x + itemBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(component.getByTestId('range-move-record')).toHaveValue('staff-3:2026-08-08:2026-08-12->staff-2:2026-08-08:2026-08-12');
});

test('opens the real task-item floating menu instead of editing directly', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);

  await component.getByRole('button', { name: /Prepare workshop.*Open actions/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await expect(component.getByTestId('task-item-action')).toHaveValue('');
  await page.getByRole('menuitem', { name: 'Edit' }).click();
  await expect(component.getByTestId('task-item-action')).toHaveValue('edit');
});

test('gives a real task item the same hover-details lifecycle as a time item', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });

  await item.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Prepare workshop');
  await expect(tooltip).toContainText('Planning / Prep');
  await expect(tooltip).toContainText('Soft Skills');
  await expect(tooltip).toContainText('Summer 2026');
  await expect(tooltip).toContainText('Hours Logged');
  await expect(tooltip).toContainText('1.50');
  await expect(tooltip).toContainText('Prepare activities and materials.');

  const box = await item.boundingBox();
  if (!box) throw new Error('Task item geometry is unavailable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(tooltip).toBeHidden();
  await page.mouse.move(box.x + box.width / 2 + 152, box.y + box.height / 2, { steps: 5 });
  await expect(tooltip).toBeHidden();
  await page.mouse.up();
});

test('renders real task and time items with the same item-shell height', async ({ mount }) => {
  const timeComponent = await mount(timeItemStoryId);
  const timeBox = await timeComponent.getByRole('button', { name: /Program Delivery, 2 hours/ }).boundingBox();
  const taskComponent = await mount(taskItemStoryId);
  const taskBox = await taskComponent.getByRole('button', { name: /Prepare workshop.*Open actions/ }).boundingBox();
  if (!timeBox || !taskBox) throw new Error('Calendar item geometry is unavailable');

  expect(taskBox.height).toBeCloseTo(timeBox.height, 0);
});

test('shows a geometry-only task resize ghost without expanding its text', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const viewport = component.getByLabel('Browser-tested task calendar');
  await viewport.evaluate(element => { element.scrollLeft -= 304; });
  const handle = component.getByRole('button', { name: 'Resize start of task-1' });
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const wrapper = item.locator('..');
  await expect(wrapper).toHaveClass(/resource-calendar__item/);
  await expect(wrapper).toHaveClass(/draggable/);
  await expect(wrapper).toHaveClass(/resizable/);
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
  await page.mouse.move(box.x + box.width / 2 - 152, box.y + box.height / 2, { steps: 5 });
  const preview = page.locator('.resource-calendar__range-preview');
  await expect(preview).toBeVisible();
  await expect(preview.getByText('Prepare workshop')).toBeHidden();
  await expect.poll(async () => (await preview.boundingBox())?.width ?? 0).toBeGreaterThan(original.width);
  await expectPreviewClippedToCalendar(component, page);
  await page.mouse.up();

  await expect(page.locator('.resource-calendar__range-preview')).toHaveCount(0);
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
  await expect(component.getByTestId('task-range-change')).toHaveValue('resize:2026-08-08:2026-08-11');
});

test('opens the real time-item action menu without starting a drag', async ({ page, mount }) => {
  const component = await mount(timeItemStoryId);

  await component.getByRole('button', { name: /Program Delivery, 2 hours/ }).click();
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Edit' }).click();

  await expect(component.getByTestId('time-item-action')).toHaveValue('edit:entry-1');
  await expect(component.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('selects the owning row when a real time item is activated without redundant selection', async ({ page, mount }) => {
  const component = await mount(timeItemStoryId);
  const item = component.getByRole('button', { name: /Administrative, 1.5 hours/ });

  await item.click();
  await expect(component.getByTestId('selected-resource')).toHaveValue('staff-2');
  await expect(component.getByTestId('resource-selection-count')).toHaveValue('1');
  await expect(item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__row")]'))
    .toHaveClass(/resource-calendar__row--selected/);
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();

  await page.keyboard.press('Escape');
  await item.click();
  await expect(component.getByTestId('resource-selection-count')).toHaveValue('1');
});

test('suppresses real time-item details from pointer down through drag end', async ({ page, mount }) => {
  const component = await mount(timeItemStoryId);
  const source = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const target = component.getByRole('button', { name: /Meeting, 1 hours/ });

  await source.hover();
  await expect(page.getByRole('tooltip')).toContainText('Workshop delivery');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Time item geometry is unavailable');

  await page.mouse.down();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.up();
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

test('auto-scrolls point items vertically through virtualized resource rows', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const source = component.getByRole('button', { name: 'Movable entry' });
  const sourceBox = await source.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!sourceBox || !viewportBox) throw new Error('Point vertical autoscroll geometry is unavailable');
  const initialTop = await viewport.evaluate(element => element.scrollTop);

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, viewportBox.y + viewportBox.height - 8, { steps: 8 });
    await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(initialTop);
    await expect(page.locator('.resource-calendar__drag-overlay')).toBeVisible();
  } finally {
    await page.mouse.up();
  }
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('auto-scrolls ranged task dragging across periods and virtualized resource rows', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Ranged task' });
  const itemBox = await item.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!itemBox || !viewportBox) throw new Error('Range autoscroll geometry is unavailable');
  const initialLeft = await viewport.evaluate(element => element.scrollLeft);
  const initialTop = await viewport.evaluate(element => element.scrollTop);

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(viewportBox.x + viewportBox.width - 8, viewportBox.y + viewportBox.height - 8, { steps: 8 });
    await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeGreaterThan(initialLeft);
    await expect.poll(() => viewport.evaluate(element => element.scrollTop)).toBeGreaterThan(initialTop);
    await expect(page.locator('.resource-calendar__range-preview')).toBeVisible();
  } finally {
    await page.mouse.up();
  }

  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('uses the period-zone edge for ranged drag autoscroll', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Ranged task' });
  const itemBox = await item.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!itemBox || !viewportBox) throw new Error('Range period-zone geometry is unavailable');
  const initialLeft = await viewport.evaluate(element => element.scrollLeft);
  expect(initialLeft).toBeGreaterThan(0);

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(viewportBox.x + 190 + 8, itemBox.y + itemBox.height / 2, { steps: 8 });
    await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeLessThan(initialLeft);
  } finally {
    await page.mouse.up();
  }
});

test('auto-scrolls while resizing a ranged task near the horizontal edge', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const handleBox = await handle.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!handleBox || !viewportBox) throw new Error('Range resize autoscroll geometry is unavailable');
  const initialLeft = await viewport.evaluate(element => element.scrollLeft);
  expect(initialLeft).toBeGreaterThan(0);

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  try {
    await page.mouse.move(viewportBox.x + 190 + 8, handleBox.y + handleBox.height / 2, { steps: 8 });
    await expect.poll(() => viewport.evaluate(element => element.scrollLeft)).toBeLessThan(initialLeft);
  } finally {
    await page.mouse.up();
  }

  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('opens the overflow panel and supports keyboard dismissal', async ({ page, mount }) => {
  const component = await mount(storyId);

  await component.getByRole('button', { name: 'Show all 3 items for 2026-08-09' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Overflow one' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});
