// This suite owns HoursCalendar browser integration with TimelineCalendar and HoursItem.
import { expect, test } from '@playwright/test';

const hoursItemStoryId = 'pages/Staff/Hours/components/HoursCalendar/HoursItem/HoursItem/InteractiveHoursItems';

test('opens the hours-item action menu without starting a drag', async ({ page, mount }) => {
  const component = await mount(hoursItemStoryId);
  const item = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const itemBox = await item.boundingBox();
  if (!itemBox) throw new Error('Hours action anchor geometry is unavailable');
  const borderColor = await item.evaluate(element => getComputedStyle(element).borderTopColor);

  await item.click();
  await expect(item).toHaveCSS('border-top-width', '2px');
  await expect(item).toHaveCSS('border-top-color', borderColor);
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await expect.poll(async () => (await page.locator('.calendar-item-menu').boundingBox())?.x)
    .toBeCloseTo(itemBox.x, 0);
  await page.getByRole('menuitem', { name: 'Edit' }).click();

  await expect(component.getByTestId('hours-item-action')).toHaveValue('edit:entry-1');
  await expect(component.locator('.item-move-preview')).toHaveCount(0);
});

test('renders hours-item type information on the trailing edge', async ({ mount }) => {
  const component = await mount(hoursItemStoryId);
  const item = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const type = item.locator('.hours-item__type');

  await expect(item).toHaveCSS('background-color', 'rgb(238, 242, 255)');
  const itemBox = await item.boundingBox();
  const typeBox = await type.boundingBox();
  if (!itemBox || !typeBox) throw new Error('Hours item layout geometry is unavailable');
  expect(itemBox.x + itemBox.width - (typeBox.x + typeBox.width)).toBeCloseTo(7, 0);
});

test('selects an hours item owning row without redundant selection', async ({ page, mount }) => {
  const component = await mount(hoursItemStoryId);
  const item = component.getByRole('button', { name: /Administrative, 1.5 hours/ });

  await item.click();
  await expect(component.getByTestId('selected-resource')).toHaveValue('staff-2');
  await expect(component.getByTestId('resource-selection-count')).toHaveValue('1');
  await expect(item.locator('xpath=ancestor::div[contains(@class, "row")]'))
    .toHaveClass(/selected/);
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();

  await page.keyboard.press('Escape');
  await item.click();
  await expect(component.getByTestId('resource-selection-count')).toHaveValue('1');
});

test('suppresses hours-item details from pointer down through drag end', async ({ page, mount }) => {
  const component = await mount(hoursItemStoryId);
  const source = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const target = component.getByRole('button', { name: /Meeting, 1 hours/ });

  await source.hover();
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toContainText('Workshop delivery');
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Hours item geometry is unavailable');
  await expect.poll(async () => (await tooltip.boundingBox())?.x).toBeCloseTo(sourceBox.x, 0);
  await expect.poll(async () => (await tooltip.boundingBox())?.y).toBeCloseTo(sourceBox.y + sourceBox.height + 8, 0);

  await page.mouse.down();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 8 });
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.mouse.up();
});
