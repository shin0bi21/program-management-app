import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type {} from '../gallery/window';

const storageKey = 'cycle-calendar:browser-position';

async function mountCalendar(page: Page, storedPosition?: { date: string; offset: number }, initialDate?: string, initialCycleIds?: string[]) {
  await page.goto('/playwright/gallery/index.html');
  await page.evaluate(({ key, position }) => {
    localStorage.removeItem(key);
    if (position) localStorage.setItem(key, JSON.stringify(position));
  }, { key: storageKey, position: storedPosition });
  await page.evaluate(props => window.mount({ story: 'CycleCalendar/CycleCalendar', props }), { initialDate, initialCycleIds });
}

async function selectCycle(page: Page, name: string) {
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('menuitem', { name: /Cycles/ }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Leap cycle', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name, exact: true }).click();
  await page.getByRole('menuitem', { name: 'Apply', exact: true }).click();
  await page.keyboard.press('Escape');
}

test('cycle selection drives complete multi-year bounds with virtualized navigation', async ({ page }) => {
  await mountCalendar(page);
  await expect(page.locator('[data-period-key="2028-02-29"]')).toBeVisible();
  await expect(page.getByLabel('Cycle bounds')).toHaveText('2028-02-28 to 2028-03-03');

  await selectCycle(page, 'Multi-year cycle');
  await expect(page.getByLabel('Cycle bounds')).toHaveText('2040-06-01 to 2044-06-05');
  await expect(page.locator('[data-period-key="2040-06-01"]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeDisabled();
  expect(await page.locator('[data-period-key]').count()).toBeLessThan(100);

  const viewport = page.getByLabel('Cycle calendar');
  await viewport.evaluate(element => { element.scrollLeft = element.scrollWidth; });
  await expect(page.locator('[data-period-key="2044-06-05"]')).toBeVisible();
  expect(await page.locator('[data-period-key]').count()).toBeLessThan(100);
  for (const name of ['Next', 'Previous']) {
    await page.getByRole('button', { name, exact: true }).click();
    const dates = await page.locator('[data-period-key]').evaluateAll(elements => elements.map(element => element.getAttribute('data-period-key')!));
    expect(dates.every(date => date >= '2040-06-01' && date <= '2044-06-05')).toBe(true);
  }

  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Date Range', exact: true })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'Clear all', exact: true }).click();
  const currentYear = await page.evaluate(() => new Date().getFullYear());
  await expect(page.getByLabel('Cycle bounds')).toHaveText(`${currentYear}-01-01 to 2044-06-05`);
});

test('clamps initial dates and restores stored positions across a multi-year cycle', async ({ page }) => {
  await mountCalendar(page, undefined, '2050-01-01', ['long']);
  await expect(page.locator('[data-period-key="2044-06-05"]')).toBeVisible();
  await expect(page.locator('[data-period-key="2050-01-01"]')).toHaveCount(0);

  await page.evaluate(() => window.unmount());
  await mountCalendar(page, { date: '2042-03-01', offset: 0 }, '2040-06-01', ['long']);
  await expect(page.locator('[data-period-key="2042-03-01"]')).toBeVisible();
  await expect(page.locator('[data-period-key="2040-06-01"]')).toHaveCount(0);
  await page.evaluate(() => window.unmount());
  await mountCalendar(page, { date: '2050-01-01', offset: 0 }, '2040-06-01', ['long']);
  await expect(page.locator('[data-period-key="2044-06-05"]')).toBeVisible();
});

test('enables Today when the selected cycle contains today', async ({ page }) => {
  await mountCalendar(page);
  await selectCycle(page, 'Current year');
  const today = page.getByRole('button', { name: 'Today', exact: true });
  await expect(today).toBeEnabled();
  await today.click();
  const key = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  await expect(page.locator(`[data-period-key="${key}"]`)).toBeVisible();
});
