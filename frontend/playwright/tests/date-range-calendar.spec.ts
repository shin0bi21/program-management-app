import { expect, test } from '@playwright/test';
import type {} from '../gallery/window';

test('applies one page date range and keeps calendar navigation within it', async ({ page }) => {
  await page.goto('/playwright/gallery/index.html');
  await page.evaluate(() => window.mount({ story: 'TimelineCalendar/PageDateRange' }));
  const dates = page.locator('[data-period-key]');
  await expect(page.locator('[data-period-key="2028-02-29"]')).toBeVisible();
  expect(await dates.evaluateAll(elements => elements.map(element => element.getAttribute('data-period-key'))))
    .toEqual(['2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02', '2028-03-03']);

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Date Range' }).click();
  await page.getByLabel('From', { exact: true }).fill('2040-06-01');
  await page.getByLabel('To', { exact: true }).fill('2040-06-05');
  await expect(page.locator('[data-period-key="2028-02-29"]')).toBeVisible();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.locator('[data-period-key="2040-06-01"]')).toBeVisible();
  await expect(page.locator('[data-period-key="2028-02-29"]')).toHaveCount(0);

  await page.getByLabel('To', { exact: true }).press('Escape');
  await expect(page.getByLabel('From', { exact: true })).toHaveCount(0);

  for (const name of ['Previous', 'Next']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await dates.evaluateAll(elements => elements.map(element => element.getAttribute('data-period-key'))))
      .toEqual(['2040-06-01', '2040-06-02', '2040-06-03', '2040-06-04', '2040-06-05']);
  }
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveCount(1);
});

test('uses identical back-arrow styling for Date Range and list categories', async ({ page }) => {
  await page.goto('/playwright/gallery/index.html');
  await page.evaluate(() => window.mount({ story: 'TimelineCalendar/PageDateRange' }));
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Status', exact: true }).click();
  const listStyle = await page.getByRole('menuitem', { name: 'Back to filter categories' }).evaluate(element => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.borderWidth, style.fontSize, style.fontWeight, style.borderRadius, style.width, style.height];
  });
  await page.getByRole('menuitem', { name: 'Back to filter categories' }).click();
  await page.getByRole('menuitem', { name: 'Date Range', exact: true }).click();
  const dateStyle = await page.getByRole('button', { name: 'Back to filter categories' }).evaluate(element => {
    const style = getComputedStyle(element);
    return [style.color, style.backgroundColor, style.borderWidth, style.fontSize, style.fontWeight, style.borderRadius, style.width, style.height];
  });
  expect(dateStyle).toEqual(listStyle);
});
