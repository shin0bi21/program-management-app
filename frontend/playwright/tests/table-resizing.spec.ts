import { expect, test, type Locator, type Page } from '@playwright/test';

async function box(locator: Locator) {
  const bounds = await locator.boundingBox();
  if (!bounds) throw new Error('Table geometry is unavailable');
  return bounds;
}

async function cellWidths(component: Locator) {
  return component.locator('thead th').evaluateAll(cells => cells.map(cell => cell.getBoundingClientRect().width));
}

async function startMouseResize(page: Page, handle: Locator) {
  const bounds = await box(handle);
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

test('previews a drag without changing distributed widths, then commits once', async ({ page, mount }) => {
  const component = await mount('Table/ResizePreview');
  const handle = component.getByRole('button', { name: 'Resize Name column' });
  const header = component.locator('th[data-column-id="name"]');
  const before = await cellWidths(component);
  const initialHeader = await box(header);

  const { x, y } = await startMouseResize(page, handle);
  await expect(component.getByTestId('resize-commits')).toHaveText('0');
  await expect(component.locator('.table-resize-guide')).toBeVisible();
  await page.mouse.move(x + 60, y, { steps: 6 });

  expect(await cellWidths(component)).toEqual(before);
  await expect(component.getByTestId('resize-commits')).toHaveText('0');
  const guide = await box(component.locator('.table-resize-guide'));
  expect(Math.abs(guide.x - initialHeader.x - initialHeader.width - 60)).toBeLessThanOrEqual(2);

  await page.mouse.up();

  await expect(component.getByTestId('resize-commits')).toHaveText('1');
  await expect(component.locator('.table-resize-guide')).toHaveCount(0);
  await expect(component.locator('.table-wrapper')).not.toHaveClass(/table-wrapper--resizing/);
  expect((await box(header)).width).toBeCloseTo(before[0] + 60, 0);
  const after = await cellWidths(component);
  after.slice(1).forEach((width, index) => expect(width).toBeCloseTo(before[index + 1], 0));
  const body = await box(component.locator('tbody tr').first().locator('td').first());
  expect(body.width).toBeCloseTo(after[0], 0);
  expect(before[3]).toBeCloseTo(40, 0);
});

for (const [delta, limit] of [[-400, 100], [800, 500]]) {
  test(`clamps the preview and released column to ${limit}px after horizontal scrolling`, async ({ page, mount }) => {
    const component = await mount('Table/ResizePreview');
    await component.getByRole('button', { name: 'Toggle viewport width' }).click();
    const wrapper = component.locator('.table-wrapper');
    await wrapper.evaluate(element => element.scrollTo({ left: 100 }));
    const header = component.locator('th[data-column-id="status"]');
    const initial = await box(header);

    const { x, y } = await startMouseResize(page, component.getByRole('button', { name: 'Resize Status column' }));
    await page.mouse.move(x + delta, y, { steps: 6 });

    const guide = await box(component.locator('.table-resize-guide'));
    expect(Math.abs(guide.x - initial.x - limit)).toBeLessThanOrEqual(2);
    await expect(component.getByTestId('resize-commits')).toHaveText('0');
    await page.mouse.up();

    await expect(component.getByTestId('resize-commits')).toHaveText('1');
    expect((await box(header)).width).toBeCloseTo(limit, 0);
  });
}

test('commits touch release using its final touch position', async ({ mount }) => {
  const component = await mount('Table/ResizePreview');
  const handle = component.getByRole('button', { name: 'Resize Status column' });
  const header = component.locator('th[data-column-id="status"]');
  const initial = await box(header);
  const start = await box(handle);
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;

  await handle.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: x, clientY: y }] });
  await handle.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: x + 40, clientY: y }] });
  await expect(component.getByTestId('resize-commits')).toHaveText('0');
  expect((await box(header)).width).toBe(initial.width);
  await handle.dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: x + 60, clientY: y }] });

  await expect(component.getByTestId('resize-commits')).toHaveText('1');
  await expect(component.locator('.table-resize-guide')).toHaveCount(0);
  expect((await box(header)).width).toBeCloseTo(initial.width + 60, 0);
});

test('retains immediate keyboard sizing, reset, and hidden saved widths', async ({ mount }) => {
  const component = await mount('Table/ResizePreview');
  await component.getByRole('button', { name: 'Toggle notes' }).click();
  const handle = component.getByRole('button', { name: 'Resize Name column' });
  const header = component.locator('th[data-column-id="name"]');
  const initial = await box(header);

  await handle.press('ArrowRight');

  await expect(component.getByTestId('resize-commits')).toHaveText('1');
  expect(Math.abs((await box(header)).width - initial.width - 10)).toBeLessThanOrEqual(1);
  await expect(component.locator('.table-resize-guide')).toHaveCount(0);
  expect(JSON.parse(await component.getByTestId('saved-widths').innerText()).notes).toBe(280);
  await handle.dblclick();
  expect(JSON.parse(await component.getByTestId('saved-widths').innerText()).name).toBeUndefined();
  await component.getByRole('button', { name: 'Toggle notes' }).click();
  expect(JSON.parse(await component.getByTestId('saved-widths').innerText()).notes).toBe(280);
  await expect(component.getByRole('button', { name: 'Resize  column' })).toHaveCount(0);
});

test('keeps body columns aligned with sticky headers during scrolling', async ({ mount }) => {
  const component = await mount('Table/ResizePreview');
  const wrapper = component.locator('.table-wrapper');
  const header = component.locator('th[data-column-id="name"]');
  const cell = component.locator('tbody tr').first().locator('td').first();
  const initial = await box(header);

  expect((await box(cell)).width).toBeCloseTo(initial.width, 0);
  await wrapper.evaluate(element => element.scrollTo({ top: 240 }));
  expect((await box(header)).y).toBeCloseTo(initial.y, 0);
});

test('keeps the guide under the pointer when the viewport scrolls during a drag', async ({ page, mount }) => {
  const component = await mount('Table/ResizePreview');
  await component.getByRole('button', { name: 'Toggle viewport width' }).click();
  const wrapper = component.locator('.table-wrapper');
  const header = component.locator('th[data-column-id="status"]');
  const initial = await box(header);

  const { x, y } = await startMouseResize(page, component.getByRole('button', { name: 'Resize Status column' }));
  await page.mouse.move(x + 30, y);
  const beforeScroll = await box(component.locator('.table-resize-guide'));
  await wrapper.evaluate(element => element.scrollTo({ left: 25, top: 80 }));
  await expect.poll(async () => (await box(component.locator('.table-resize-guide'))).x).toBeCloseTo(beforeScroll.x, 0);
  const guide = await box(component.locator('.table-resize-guide'));
  const viewport = await box(wrapper);
  expect(guide.y).toBeCloseTo(viewport.y + 1, 0);
  await page.mouse.up();

  await expect(component.getByTestId('resize-commits')).toHaveText('1');
  expect((await box(header)).width).toBeCloseTo(initial.width + 55, 0);
});

test('caps initial widths in a wide viewport without moving a sibling on resize', async ({ page, mount }) => {
  await page.setViewportSize({ width: 1800, height: 720 });
  const component = await mount('Table/ResizePreview');
  await component.getByRole('button', { name: 'Toggle notes' }).click();
  await component.locator('.table-wrapper').evaluate(wrapper => {
    wrapper.parentElement!.style.width = '1700px';
  });
  await expect.poll(async () => (await cellWidths(component)).slice(0, 2)).toEqual([500, 500]);
  const before = await cellWidths(component);

  await component.getByRole('button', { name: 'Resize Name column' }).press('ArrowLeft');

  await expect(component.getByTestId('resize-commits')).toHaveText('1');
  const after = await cellWidths(component);
  expect(after).toEqual([500, before[1], 40]);
  expect(JSON.parse(await component.getByTestId('saved-widths').innerText()).notes).toBe(280);
});


for (const width of [820.25, 820.5, 820.75]) {
  test(`fits a fractional ${width}px viewport without a horizontal scrollbar`, async ({ page, mount }) => {
    const component = await mount('Table/ResizePreview');
    const wrapper = component.locator('.table-wrapper');
    await wrapper.evaluate((element, width) => {
      element.parentElement!.style.width = `${width}px`;
    }, width);
    const horizontalOverflow = () => wrapper.evaluate(element => new Promise<number>(resolve => {
      const observer = new ResizeObserver(([entry]) => {
        observer.disconnect();
        resolve(element.querySelector('table')!.getBoundingClientRect().width - entry.contentRect.width);
      });
      observer.observe(element);
    }));

    await expect(wrapper).toHaveCSS('overflow-x', 'auto');
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(0);
    const handle = component.getByRole('button', { name: 'Resize Name column' });
    const start = await box(handle);
    await page.mouse.click(start.x + start.width / 2, start.y + start.height / 2);
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(0);
    const before = await cellWidths(component);
    const header = await box(component.locator('th[data-column-id="name"]'));
    const { x, y } = await startMouseResize(page, handle);
    await page.mouse.move(x - 100, y);
    expect(await cellWidths(component)).toEqual(before);
    expect(Math.abs((await box(component.locator('.table-resize-guide'))).x - header.x - header.width)).toBeLessThanOrEqual(2);
    await page.mouse.up();
    await expect.poll(horizontalOverflow).toBeLessThanOrEqual(0);

    await handle.press('ArrowLeft');
    await expect.poll(horizontalOverflow).toBe(0);
    const after = await cellWidths(component);
    after.forEach((size, index) => expect(size).toBeCloseTo(before[index], 0));
    await handle.press('ArrowRight');
    await expect.poll(horizontalOverflow).toBeGreaterThan(0);
    await wrapper.evaluate(element => element.scrollTo({ left: 10 }));
    expect(await wrapper.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  });
}
