import { expect, test, type Locator, type Page } from '@playwright/test';

const storyId = 'ResourceCalendar/Interactive';
const rangeLaneSizingStoryId = 'ResourceCalendar/RangeLaneSizing';
const itemDensityStoryId = 'ResourceCalendar/ItemDensity';
const persistedPositionStoryId = 'ResourceCalendar/PersistedPosition';
const timeItemStoryId = 'pages/Staff/Hours/components/HoursCalendarView/TimeItem/TimeItem/InteractiveTimeItems';
const taskItemStoryId = 'pages/Staff/Tasks/components/TaskCalendarView/TaskItem/TaskItem/InteractiveTaskItem';
const periodWidth = 145;
const resourceWidth = 125;

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

async function fullyVisiblePeriodKeys(component: Locator) {
  const viewport = component.getByLabel('Persisted-position resource calendar');
  return viewport.evaluate(calendar => {
    const viewportBounds = calendar.getBoundingClientRect();
    const resourceBounds = calendar.querySelector('.resource-calendar__corner')?.getBoundingClientRect();
    if (!resourceBounds) throw new Error('Calendar resource boundary is unavailable');
    return [...calendar.querySelectorAll<HTMLElement>('.resource-calendar__period')].filter(period => {
      const bounds = period.getBoundingClientRect();
      return bounds.left >= resourceBounds.right - 1 && bounds.right <= viewportBounds.right + 1;
    }).map(period => period.dataset.periodKey!);
  });
}

test('restores the exact left day and offset after scrolling through the right edge', async ({ page, mount }) => {
  await mount(persistedPositionStoryId);
  await page.evaluate(() => localStorage.removeItem('resource-calendar:playwright-position'));
  await page.evaluate(() => window.unmount());
  const component = await mount(persistedPositionStoryId);
  const viewport = component.getByLabel('Persisted-position resource calendar');

  await viewport.evaluate((element, width) => { element.scrollLeft += 8 * width + 37; }, periodWidth);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('resource-calendar:playwright-position'))).not.toBeNull();
  await expect.poll(async () => {
    const stored = await page.evaluate(() => localStorage.getItem('resource-calendar:playwright-position'));
    return stored ? JSON.parse(stored).offset : null;
  }).toBe(await viewport.evaluate((element, width) => element.scrollLeft % width, periodWidth));
  const scrollLeftBeforeRemount = await viewport.evaluate(element => element.scrollLeft);
  const storedPosition = await page.evaluate(() => localStorage.getItem('resource-calendar:playwright-position'));
  expect(JSON.parse(storedPosition!)).toEqual(expect.objectContaining({
    offset: scrollLeftBeforeRemount % periodWidth,
  }));
  const visibleBeforeRemount = await fullyVisiblePeriodKeys(component);

  await page.evaluate(() => window.unmount());
  const remounted = await mount(persistedPositionStoryId);
  const remountedViewport = remounted.getByLabel('Persisted-position resource calendar');
  await expect(remountedViewport).toBeVisible();
  const visibleAfterRemount = await fullyVisiblePeriodKeys(remounted);
  const scrollLeftAfterRemount = await remountedViewport.evaluate(element => element.scrollLeft);

  expect(visibleAfterRemount).toEqual(visibleBeforeRemount);
  expect(scrollLeftAfterRemount % periodWidth).toBeCloseTo(scrollLeftBeforeRemount % periodWidth, 0);
});

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

test('updates the centered toolbar year as the visible timeline crosses a year boundary', async ({ mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');

  await expect(component.getByLabel('Calendar year 2026')).toBeVisible();
  await viewport.evaluate((element, width) => { element.scrollLeft += 365 * width; }, periodWidth);
  await expect(component.getByLabel('Calendar year 2027')).toBeVisible();
});

test('keeps each overlap group aligned at its peak density', async ({ mount }) => {
  const component = await mount(rangeLaneSizingStoryId);
  const row = component.locator('.resource-calendar__row');
  const longTask = component.getByRole('button', { name: 'First ranged task' });
  const crowdedGroup = longTask.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const isolatedGroup = component.getByRole('button', { name: 'Isolated ranged task' })
    .locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const allItems = component.locator('.resource-calendar__range-item');
  const rowBox = await row.boundingBox();
  if (!rowBox) throw new Error('Range lane geometry is unavailable');

  await expect(row).toHaveCSS('height', '112px');
  await expect(longTask).toHaveCount(1);
  await expect(crowdedGroup).toHaveAttribute('data-range-density', 'dense');
  await expect(isolatedGroup).toHaveAttribute('data-range-density', 'normal');
  await expect(longTask).toHaveCSS('font-size', '8.8px');
  await expect(component.getByRole('button', { name: 'Isolated ranged task' })).toHaveCSS('font-size', '12.4px');
  for (const item of await allItems.all()) {
    const box = await item.boundingBox();
    if (!box) throw new Error('Range item geometry is unavailable');
    expect(box.y).toBeGreaterThanOrEqual(rowBox.y);
    expect(box.y + box.height).toBeLessThanOrEqual(rowBox.y + rowBox.height);
  }
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

test('leaves a touch gesture that begins on an entry available for calendar scrolling', async ({ page, mount }) => {
  const component = await mount(storyId);
  const source = component.getByRole('button', { name: 'Movable entry' });
  const wrapper = source.locator('..');
  const box = await source.boundingBox();
  if (!box) throw new Error('Touch item geometry is unavailable');

  await source.evaluate((element, point) => {
    element.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: point.x,
      clientY: point.y,
      pointerId: 19,
      pointerType: 'touch',
    }));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  await page.evaluate(point => {
    window.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: point.x + 80,
      clientY: point.y,
      pointerId: 19,
      pointerType: 'touch',
    }));
    window.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: point.x + 80,
      clientY: point.y,
      pointerId: 19,
      pointerType: 'touch',
    }));
  }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });

  await expect(component.getByTestId('drop-record')).toHaveValue('');
  await expect(component.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
  await expect.poll(() => wrapper.evaluate(element => getComputedStyle(element).touchAction)).toBe('auto');
});

test('clips a point-item ghost to the same calendar preview host', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Movable entry' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Point drag geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10, { steps: 4 });
  await expect(page.locator('.resource-calendar__drag-overlay')).toBeVisible();
  await expect.poll(() => viewport.evaluate(element => getComputedStyle(element).cursor)).toBe('grabbing');
  await expectPreviewClippedToCalendar(component, page);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));

  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
  await expect(component.getByTestId('drop-record')).toHaveValue('');
});

test('keeps the point-item ghost under the exact place it was grabbed', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Movable entry' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Point drag geometry is unavailable');
  const pickup = { x: box.x + box.width * .7, y: box.y + box.height * .35 };
  const destination = { x: pickup.x + 35, y: pickup.y + 18 };

  await page.mouse.move(pickup.x, pickup.y);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 4 });

  const preview = await page.locator('.resource-calendar__drag-overlay').boundingBox();
  if (!preview) throw new Error('Point drag preview is unavailable');
  expect(destination.x - preview.x).toBeCloseTo(pickup.x - box.x, 0);
  expect(destination.y - preview.y).toBeCloseTo(pickup.y - box.y, 0);

  await page.mouse.up();
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
  await page.mouse.move(handleBox.x + handleBox.width / 2 + periodWidth - 1, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(component.getByTestId('resize-record')).toHaveValue('end:2026-08-08:2026-08-12->2026-08-08:2026-08-13');
  await expect(component.getByTestId('activation-record')).toHaveValue('');
  const after = await item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]').boundingBox();
  expect((after?.width ?? 0) - before.width).toBeCloseTo(periodWidth, 0);
});

test('keeps the opposite ghost edge fixed while resizing from the start', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const handle = component.getByRole('button', { name: 'Resize start of ranged-task' });
  const before = await wrapper.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!before || !handleBox) throw new Error('Start-edge resize geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 100, handleBox.y + handleBox.height / 2, { steps: 6 });
  const preview = await page.locator('.resource-calendar__range-preview').boundingBox();
  if (!preview) throw new Error('Start-edge resize preview is unavailable');

  expect(preview.x + preview.width).toBeCloseTo(before.x + before.width, 0);
  await page.mouse.up();
});

test('lets the resize ghost follow the cursor freely before snapping on release', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const before = await wrapper.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!before || !handleBox) throw new Error('Free resize geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  const cursorX = handleBox.x + handleBox.width / 2 + 43;
  await page.mouse.move(cursorX, handleBox.y + handleBox.height / 2, { steps: 4 });
  const preview = await page.locator('.resource-calendar__range-preview').boundingBox();
  if (!preview) throw new Error('Free resize preview is unavailable');

  expect(preview.x + preview.width).toBeCloseTo(cursorX, 0);
  await page.mouse.up();
  const after = await wrapper.boundingBox();
  expect(Math.abs((after?.width ?? 0) - before.width)).not.toBeCloseTo(43, 0);
});

test('continues resizing after leaving and re-entering the calendar viewport', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const viewportBox = await viewport.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!viewportBox || !handleBox) throw new Error('Resize re-entry geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + viewportBox.width + 40, handleBox.y + handleBox.height / 2, { steps: 8 });
  const outsideWidth = (await page.locator('.resource-calendar__range-preview').boundingBox())?.width;
  await page.mouse.move(viewportBox.x + viewportBox.width - 220, handleBox.y + handleBox.height / 2, { steps: 8 });
  const returnedWidth = (await page.locator('.resource-calendar__range-preview').boundingBox())?.width;
  if (outsideWidth === undefined || returnedWidth === undefined) throw new Error('Resize preview disappeared during re-entry');

  expect(returnedWidth).not.toBeCloseTo(outsideWidth, 0);
  await page.mouse.up();
  await expect(component.getByTestId('resize-record')).not.toHaveValue('');
  await expect(page.locator('.resource-calendar__range-preview')).toHaveCount(0);
});

test('commits resize when pointer capture is lost before pointerup', async ({ page, mount }) => {
  const component = await mount(storyId);
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('Resize handle geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 150, handleBox.y + handleBox.height / 2, { steps: 4 });
  await handle.evaluate(element => {
    element.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  });

  await expect(component.getByTestId('resize-record')).not.toHaveValue('');
  await expect(page.locator('.resource-calendar__range-preview')).toHaveCount(0);
});

test('keeps range movement locked out while a resize pointer owns the calendar', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const itemBox = await item.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!itemBox || !handleBox) throw new Error('Range interaction lock geometry is unavailable');

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await wrapper.dispatchEvent('pointerdown', {
    pointerId: 32, button: 0, clientX: itemBox.x + itemBox.width / 2, clientY: itemBox.y + itemBox.height / 2,
  });
  await page.mouse.move(handleBox.x + handleBox.width / 2 + periodWidth, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(component.getByTestId('resize-record')).not.toHaveValue('');
  await expect(component.getByTestId('range-move-record')).toHaveValue('');
});

test('keeps range resize locked out while a move pointer owns the calendar', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const itemBox = await item.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!itemBox || !handleBox) throw new Error('Range interaction lock geometry is unavailable');

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await handle.dispatchEvent('pointerdown', {
    pointerId: 42, button: 0, clientX: handleBox.x + handleBox.width / 2, clientY: handleBox.y + handleBox.height / 2,
  });
  await page.mouse.move(itemBox.x + itemBox.width / 2 + periodWidth, itemBox.y + itemBox.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect(component.getByTestId('range-move-record')).not.toHaveValue('');
  await expect(component.getByTestId('resize-record')).toHaveValue('');
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
  await page.mouse.move(itemBox.x + itemBox.width / 2 + periodWidth, itemBox.y + itemBox.height / 2, { steps: 6 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  await expect(component.getByTestId('range-move-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);

  const handle = component.getByRole('button', { name: 'Resize end of ranged-task' });
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error('Range resize cancellation geometry is unavailable');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + periodWidth, handleBox.y + handleBox.height / 2, { steps: 6 });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })));
  await expect(component.getByTestId('resize-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('commits ranged movement when pointer capture is lost before pointerup', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const box = await item.boundingBox();
  if (!box) throw new Error('Lost-capture geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await wrapper.evaluate(element => {
    element.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
  });

  await expect(component.getByTestId('range-move-record')).not.toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('cancels ranged movement after genuine pointer capture loss', async ({ page, mount }) => {
  const component = await mount(storyId);
  const item = component.getByRole('button', { name: 'Ranged task' });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const box = await item.boundingBox();
  if (!box) throw new Error('Lost-capture cancellation geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await wrapper.dispatchEvent('lostpointercapture', { pointerId: 1 });

  await expect(component.getByTestId('range-move-record')).toHaveValue('');
  await expect(page.locator('.resource-calendar__preview-host')).toHaveCount(0);
});

test('moves a ranged item while preserving its duration and suppressing activation', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Ranged task' });
  const box = await item.boundingBox();
  if (!box) throw new Error('Range move geometry is unavailable');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + periodWidth, box.y + box.height / 2, { steps: 6 });
  await expect(page.locator('.resource-calendar__range-preview')).toBeVisible();
  await expect.poll(() => viewport.evaluate(element => getComputedStyle(element).cursor)).toBe('grabbing');
  await expect(page.locator('.resource-calendar__range-move-preview').getByText('Ranged task')).toBeVisible();
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
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const itemBox = await item.boundingBox();
  const row = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__row")]');
  if (!itemBox) throw new Error('Task action anchor geometry is unavailable');
  const pointerX = itemBox.x + itemBox.width * .65;
  const dayIndex = await row.locator('.resource-calendar__item-slot').evaluateAll((slots, x) => slots.findIndex(slot => {
    const bounds = slot.getBoundingClientRect();
    return x >= bounds.left && x < bounds.right;
  }), pointerX);
  const dayBox = await row.locator('.resource-calendar__item-slot').nth(dayIndex).boundingBox();
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

test('gives a real task item the same hover-details lifecycle as a time item', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const rangeItem = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  const row = rangeItem.locator('xpath=ancestor::div[contains(@class, "resource-calendar__row")]');
  const itemBox = await item.boundingBox();
  if (!itemBox) throw new Error('Task detail anchor geometry is unavailable');
  const pointerX = itemBox.x + itemBox.width * .2;
  const day = row.locator('.resource-calendar__item-slot').evaluateAll((slots, x) => {
    const index = slots.findIndex(slot => {
      const bounds = slot.getBoundingClientRect();
      return x >= bounds.left && x < bounds.right;
    });
    if (index < 0) throw new Error('Hovered task day is unavailable');
    return index;
  }, pointerX);
  const hoveredDay = row.locator('.resource-calendar__item-slot').nth(await day);
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
  await page.waitForTimeout(180);
  expect((await tooltip.boundingBox())?.x).toBeCloseTo(lockedPosition?.x ?? 0, 0);

  const box = await item.boundingBox();
  if (!box) throw new Error('Task item geometry is unavailable');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(tooltip).toBeHidden();
  await page.mouse.move(box.x + box.width / 2 + periodWidth, box.y + box.height / 2, { steps: 5 });
  await expect(tooltip).toBeHidden();
  await page.mouse.up();
});

test('keeps ranged tasks compact enough for three lanes', async ({ mount }) => {
  const timeComponent = await mount(timeItemStoryId);
  const timeBox = await timeComponent.getByRole('button', { name: /Program Delivery, 2 hours/ }).boundingBox();
  const taskComponent = await mount(taskItemStoryId);
  const taskBox = await taskComponent.getByRole('button', { name: /Prepare workshop.*Open actions/ }).boundingBox();
  if (!timeBox || !taskBox) throw new Error('Calendar item geometry is unavailable');

  expect(taskBox.height).toBe(26);
  expect(taskBox.height).toBeLessThan(timeBox.height);
});

test('shows a geometry-only task resize ghost without expanding its text', async ({ page, mount }) => {
  const component = await mount(taskItemStoryId);
  const viewport = component.getByLabel('Browser-tested task calendar');
  await viewport.evaluate(element => { element.scrollLeft -= 304; });
  const handle = component.getByRole('button', { name: 'Resize start of task-1' });
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const wrapper = item.locator('xpath=ancestor::div[contains(@class, "resource-calendar__range-item")]');
  await expect(wrapper).toHaveClass(/resource-calendar__item/);
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
  const preview = page.locator('.resource-calendar__range-resize-preview');
  await expect(preview).toBeVisible();
  await expect.poll(() => viewport.evaluate(element => getComputedStyle(element).cursor)).toBe('ew-resize');
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
  const item = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const itemBox = await item.boundingBox();
  if (!itemBox) throw new Error('Time action anchor geometry is unavailable');
  const borderColor = await item.evaluate(element => getComputedStyle(element).borderTopColor);

  await item.click();
  await expect(item).toHaveCSS('border-top-width', '2px');
  await expect(item).toHaveCSS('border-top-color', borderColor);
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await expect.poll(async () => (await page.locator('.calendar-item-menu').boundingBox())?.x)
    .toBeCloseTo(itemBox.x, 0);
  await page.getByRole('menuitem', { name: 'Edit' }).click();

  await expect(component.getByTestId('time-item-action')).toHaveValue('edit:entry-1');
  await expect(component.locator('.resource-calendar__drag-overlay')).toHaveCount(0);
});

test('renders time items on an opaque surface with the type aligned right', async ({ mount }) => {
  const component = await mount(timeItemStoryId);
  const item = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const type = item.locator('.time-item__type');

  await expect(item).toHaveCSS('background-color', 'rgb(238, 242, 255)');
  const itemBox = await item.boundingBox();
  const typeBox = await type.boundingBox();
  if (!itemBox || !typeBox) throw new Error('Time item layout geometry is unavailable');
  expect(itemBox.x + itemBox.width - (typeBox.x + typeBox.width)).toBeCloseTo(7, 0);
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
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Workshop delivery');
  const sourceBox = await source.boundingBox();
  const dayBox = await source.locator('xpath=ancestor::div[contains(@class, "resource-calendar__item-slot")]').boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !dayBox || !targetBox) throw new Error('Time item geometry is unavailable');
  await expect.poll(async () => (await tooltip.boundingBox())?.x).toBeCloseTo(sourceBox.x, 0);
  await expect.poll(async () => (await tooltip.boundingBox())?.y).toBeCloseTo(sourceBox.y + sourceBox.height + 8, 0);

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

test('keeps moving a ranged task after its original periods leave the virtualized slice', async ({ page, mount }) => {
  const component = await mount(storyId);
  const viewport = component.getByLabel('Browser-tested resource calendar');
  const item = component.getByRole('button', { name: 'Ranged task' });
  const itemBox = await item.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!itemBox || !viewportBox) throw new Error('Long range-move geometry is unavailable');
  const initialLeft = await viewport.evaluate(element => element.scrollLeft);

  await page.mouse.move(itemBox.x + itemBox.width / 2, itemBox.y + itemBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(viewportBox.x + viewportBox.width - 8, itemBox.y + itemBox.height / 2, { steps: 8 });
  await expect.poll(
    () => viewport.evaluate(element => element.scrollLeft),
    { timeout: 10_000 },
  ).toBeGreaterThan(initialLeft + 18 * periodWidth);
  await page.mouse.up();

  const record = await component.getByTestId('range-move-record').inputValue();
  const nextStart = record.split('->')[1]?.split(':')[1];
  expect(nextStart).toBeDefined();
  expect(nextStart! > '2026-08-22').toBe(true);
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
    await page.mouse.move(viewportBox.x + resourceWidth + 8, itemBox.y + itemBox.height / 2, { steps: 8 });
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
    await page.mouse.move(viewportBox.x + resourceWidth + 8, handleBox.y + handleBox.height / 2, { steps: 8 });
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

test('fits normal, compact, and dense items without changing the virtualized row height', async ({ mount }) => {
  const component = await mount(itemDensityStoryId);
  const row = component.locator('.resource-calendar__row');
  const compactSlot = component.locator('[data-item-period="2026-08-10"]');
  const denseSlot = component.locator('[data-item-period="2026-08-11"]');

  await expect(row).toHaveCSS('height', '112px');
  await expect(compactSlot).toHaveClass(/resource-calendar__item-slot--compact/);
  await expect(denseSlot).toHaveClass(/resource-calendar__item-slot--dense/);
  await expect(compactSlot.getByRole('button')).toHaveCount(5);
  await expect(denseSlot.getByRole('button')).toHaveCount(7);
  await expect(denseSlot.getByRole('button').first()).toHaveCSS('font-size', '8.8px');
  await expect(component.getByRole('button', { name: /Show all/ })).toHaveCount(0);
});
