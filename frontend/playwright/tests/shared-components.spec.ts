import { expect, test } from '@playwright/test';

test.describe('SearchInput', () => {
  test('keeps the field and actions inside one focused outer bar', async ({ mount }) => {
    const component = await mount('SearchInput/Interactive');
    const searchBar = component.locator('.search-input');
    const input = component.getByRole('textbox', { name: 'Search tasks' });

    await input.focus();

    await expect(searchBar).toHaveCSS('box-shadow', /rgb/);
    await expect(input).toHaveCSS('box-shadow', 'none');

    const barBox = await searchBar.boundingBox();
    const childBoxes = await Promise.all([
      input.boundingBox(),
      component.getByRole('button', { name: 'Search', exact: true }).boundingBox(),
      component.getByRole('button', { name: 'Clear search' }).boundingBox(),
    ]);
    if (!barBox || childBoxes.some(box => !box)) throw new Error('Search bar geometry is unavailable');

    for (const childBox of childBoxes) {
      if (!childBox) continue;
      expect(childBox.x).toBeGreaterThanOrEqual(barBox.x);
      expect(childBox.y).toBeGreaterThanOrEqual(barBox.y);
      expect(childBox.x + childBox.width).toBeLessThanOrEqual(barBox.x + barBox.width);
      expect(childBox.y + childBox.height).toBeLessThanOrEqual(barBox.y + barBox.height);
    }
  });
});

test.describe('FloatingMenu', () => {
  test('supports keyboard navigation, dismissal, and focus return', async ({ page, mount }) => {
    const component = await mount('FloatingMenu/Interactive');
    const trigger = component.getByRole('button', { name: 'Actions' });

    await trigger.click();
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: 'Duplicate' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('closes on an outside pointer interaction', async ({ page, mount }) => {
    const component = await mount('FloatingMenu/Interactive');
    await component.getByRole('button', { name: 'Actions' }).click();
    await component.getByRole('button', { name: 'Outside target' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('flips and clamps the panel inside the viewport', async ({ page, mount }) => {
    const component = await mount('FloatingMenu/EdgeCollision');
    const trigger = component.getByRole('button', { name: 'Edge actions' });
    await trigger.click();

    const menuBox = await page.getByRole('menu').boundingBox();
    const triggerBox = await trigger.boundingBox();
    const viewport = page.viewportSize();
    if (!menuBox || !triggerBox || !viewport) throw new Error('Floating menu geometry is unavailable');

    expect(menuBox.x).toBeGreaterThanOrEqual(0);
    expect(menuBox.y).toBeGreaterThanOrEqual(0);
    expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width);
    expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height);
    expect(menuBox.y).toBeLessThan(triggerBox.y);
  });

  test('repositions when open menu content changes size', async ({ page, mount }) => {
    const component = await mount('FloatingMenu/ResizeAware');
    await component.getByRole('button', { name: 'Resize-aware actions' }).click();
    const menu = page.getByRole('menu');
    const initialBox = await menu.boundingBox();
    if (!initialBox) throw new Error('Floating menu geometry is unavailable');

    await page.getByRole('menuitem', { name: 'Show more' }).click();
    await expect(page.getByRole('menuitem', { name: 'Extra action 6' })).toBeVisible();
    await expect.poll(async () => (await menu.boundingBox())?.y).toBeLessThan(initialBox.y);
  });
});

test.describe('Modal', () => {
  test('traps focus and identifies itself as a labelled dialog', async ({ page, mount }) => {
    const component = await mount('Modal/Interactive');
    await component.getByRole('button', { name: 'Open profile' }).click();

    const dialog = component.getByRole('dialog', { name: 'Edit profile' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  });

  test('closes with Escape and returns focus to the opener', async ({ page, mount }) => {
    const component = await mount('Modal/Interactive');
    const opener = component.getByRole('button', { name: 'Open profile' });
    await opener.click();
    await page.keyboard.press('Escape');

    await expect(component.getByRole('dialog')).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test('cannot be dismissed while close is disabled', async ({ page, mount }) => {
    const component = await mount('Modal/CloseDisabled');
    await component.getByRole('button', { name: 'Open submitting modal' }).click();
    await page.keyboard.press('Escape');

    await expect(component.getByRole('dialog', { name: 'Submitting' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  test('automatically disables dismissal while submitting', async ({ page, mount }) => {
    const component = await mount('Modal/Submitting');
    await component.getByRole('button', { name: 'Open active submission' }).click();
    await page.keyboard.press('Escape');

    await expect(component.getByRole('dialog', { name: 'Active submission' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  test('keeps dismissal disabled during a pending success delay', async ({ page, mount }) => {
    const component = await mount('Modal/SuccessDelay');
    await component.getByRole('button', { name: 'Open success delay' }).click();
    await page.keyboard.press('Escape');

    await expect(component.getByRole('dialog', { name: 'Success delay' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  test('automatically disables dismissal after submission succeeds', async ({ page, mount }) => {
    const component = await mount('Modal/Success');
    await component.getByRole('button', { name: 'Open completed submission' }).click();
    await page.keyboard.press('Escape');

    await expect(component.getByRole('dialog', { name: 'Completed submission' })).toBeVisible();
    await expect(component.getByRole('button', { name: 'Close' })).toBeDisabled();
  });
});

test.describe('Table', () => {
  test('loads the next page through a real intersection observer', async ({ mount }) => {
    const component = await mount('Table/InfiniteScroll');
    const wrapper = component.locator('.table-wrapper');

    await wrapper.evaluate(element => element.scrollTo({ top: element.scrollHeight }));

    await expect(component.getByText('Person 60')).toBeAttached();
    await expect(component.getByTestId('load-count')).toHaveText('1');
  });

  test('retains rows and pauses a visible sentinel through failed explicit retries', async ({ mount }) => {
    const component = await mount('Table/NextPageFailure');
    const wrapper = component.locator('.table-wrapper');
    await expect(component.getByText('Person 30', { exact: true })).toBeAttached();
    await wrapper.evaluate(element => element.scrollTo({ top: element.scrollHeight }));

    await expect(component.getByText('More rows unavailable')).toBeVisible();
    await expect(component.getByTestId('pagination-attempts')).toHaveText('1');
    await expect(component.getByText('Person 1', { exact: true })).toBeAttached();
    await component.getByRole('button', { name: 'Retry' }).click();
    await expect(component.getByTestId('pagination-attempts')).toHaveText('2');
    await expect(component.getByRole('button', { name: 'Retry' })).toBeVisible();

    await wrapper.evaluate(element => element.scrollTo({ top: 0 }));
    await wrapper.evaluate(element => element.scrollTo({ top: element.scrollHeight }));
    await expect(component.getByTestId('pagination-attempts')).toHaveText('2');
    await component.getByRole('button', { name: 'Retry' }).click();
    await expect(component.getByText('Person 60', { exact: true })).toBeAttached();
    await expect(component.getByText('More rows unavailable')).toHaveCount(0);
    await expect(component.getByTestId('pagination-attempts')).toHaveText('3');
  });

  test('keeps its header sticky during vertical scrolling', async ({ mount }) => {
    const component = await mount('Table/InfiniteScroll');
    const wrapper = component.locator('.table-wrapper');
    const header = component.getByRole('columnheader', { name: 'Name' });
    const initialTop = (await header.boundingBox())?.y;

    await wrapper.evaluate(element => element.scrollTo({ top: 220 }));

    expect((await header.boundingBox())?.y).toBeCloseTo(initialTop ?? 0, 0);
  });

  test('supports horizontal scrolling and pointer-based column resizing', async ({ page, mount }) => {
    const component = await mount('Table/InfiniteScroll');
    const wrapper = component.locator('.table-wrapper');
    const nameHeader = component.getByRole('columnheader', { name: 'Name' });
    const resizeHandle = component.getByRole('button', { name: 'Resize Name column' });
    const initialWidth = (await nameHeader.boundingBox())?.width ?? 0;

    await wrapper.evaluate(element => element.scrollTo({ left: element.scrollWidth }));
    await expect.poll(() => wrapper.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);

    await wrapper.evaluate(element => element.scrollTo({ left: 0 }));
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('Resize handle geometry is unavailable');
    const startX = handleBox.x + handleBox.width / 2;
    const startY = handleBox.y + handleBox.height / 2;
    await resizeHandle.dispatchEvent('mousedown', { button: 0, buttons: 1, clientX: startX, clientY: startY });
    await page.mouse.move(startX + 60, startY, { steps: 6 });
    await page.mouse.up();

    await expect.poll(async () => (await nameHeader.boundingBox())?.width ?? 0).toBeGreaterThan(initialWidth + 40);
  });
});
