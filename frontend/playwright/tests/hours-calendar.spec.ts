import { expect, test } from '@playwright/test';

const hoursItemStoryId = 'pages/Staff/Hours/components/HoursCalendar/HoursItem/HoursItem/InteractiveHoursItems';

test('renders hours-item type information on the trailing edge', async ({ mount }) => {
  const component = await mount(hoursItemStoryId);
  const item = component.getByRole('button', { name: /Program Delivery, 2 hours/ });
  const type = item.locator('.hours-item__type');

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
