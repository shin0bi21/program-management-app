import { expect, test, type Page } from '@playwright/test';

const storageKey = 'table-layout:v1:browser-layout-user:task-preferences';

async function mountLayout(page: Page) {
  await page.waitForFunction(() => typeof window.mount === 'function');
  await page.evaluate(() => window.mount({ story: 'useTableLayout/DeviceLocalLayout' }));
  await expect(page.getByRole('table', { name: 'Device layout table' })).toBeVisible();
}

async function savedLayout(page: Page) {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), storageKey);
}

async function nameWidth(page: Page) {
  return page.locator('th[data-column-id="name"]').evaluate(element => element.getBoundingClientRect().width);
}

test('keeps mobile and desktop layouts independent and restores each after reload', async ({ browser, baseURL }) => {
  if (!baseURL) throw new Error('Component gallery URL is missing');
  const desktopContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  try {
    for (const context of [desktopContext, mobileContext]) {
      await context.addInitScript(() => {
        localStorage.setItem('user', JSON.stringify({
          id: 'browser-layout-user', firstName: 'Browser', lastName: 'User', email: 'browser@example.com',
        }));
      });
    }
    const desktop = await desktopContext.newPage();
    const mobile = await mobileContext.newPage();
    await Promise.all([desktop.goto(baseURL), mobile.goto(baseURL)]);
    await Promise.all([mountLayout(desktop), mountLayout(mobile)]);

    const desktopInitialWidth = await nameWidth(desktop);
    await desktop.getByRole('button', { name: 'Resize Name column' }).press('ArrowRight');
    await expect.poll(() => nameWidth(desktop)).toBeGreaterThan(desktopInitialWidth);
    const desktopSaved = await savedLayout(desktop);
    const desktopWidth = await nameWidth(desktop);
    expect(desktopSaved.hiddenColumns).toEqual([]);
    expect(await savedLayout(mobile)).toBeNull();

    await mobile.getByRole('button', { name: 'Toggle status column' }).tap();
    await expect(mobile.locator('th[data-column-id="status"]')).toHaveCount(0);
    const mobileInitialWidth = await nameWidth(mobile);
    const handle = mobile.getByRole('button', { name: 'Resize Name column' });
    const bounds = await handle.boundingBox();
    if (!bounds) throw new Error('Mobile resize handle is missing');
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await handle.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: x, clientY: y }] });
    await handle.dispatchEvent('touchend', { touches: [], changedTouches: [{ identifier: 1, clientX: x - 60, clientY: y }] });
    await expect.poll(() => nameWidth(mobile)).toBeLessThan(mobileInitialWidth);
    const mobileSaved = await savedLayout(mobile);
    const mobileWidth = await nameWidth(mobile);
    expect(mobileSaved.hiddenColumns).toEqual(['status']);
    expect(mobileSaved.columnWidths.name).toBeLessThan(desktopSaved.columnWidths.name);

    expect(await savedLayout(desktop)).toEqual(desktopSaved);
    expect(await nameWidth(desktop)).toBe(desktopWidth);
    await expect(desktop.locator('th[data-column-id="status"]')).toBeVisible();

    await Promise.all([desktop.reload(), mobile.reload()]);
    await Promise.all([mountLayout(desktop), mountLayout(mobile)]);
    expect(await savedLayout(desktop)).toEqual(desktopSaved);
    expect(await savedLayout(mobile)).toEqual(mobileSaved);
    await expect.poll(() => nameWidth(desktop)).toBeCloseTo(desktopWidth, 0);
    await expect.poll(() => nameWidth(mobile)).toBeCloseTo(mobileWidth, 0);
    await expect(desktop.locator('th[data-column-id="status"]')).toBeVisible();
    await expect(mobile.locator('th[data-column-id="status"]')).toHaveCount(0);

    await mobile.evaluate(() => window.unmount());
    await mountLayout(mobile);
    expect(await savedLayout(mobile)).toEqual(mobileSaved);
    await expect(mobile.locator('th[data-column-id="status"]')).toHaveCount(0);
  } finally {
    await Promise.all([desktopContext.close(), mobileContext.close()]);
  }
});
