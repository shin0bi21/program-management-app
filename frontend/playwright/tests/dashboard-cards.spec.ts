import { expect, test } from '@playwright/test';
import type {} from '../gallery/window';

for (const width of [1280, 390]) {
  test.describe(`dashboard cards at ${width}px`, () => {
    test.use({ viewport: { width, height: 800 } });

    for (const { story, height } of [
      { story: 'DashboardCard/LoadingAndOverflow', height: '125px' },
      { story: 'ProgramOverviewDashboardCard/ProgramDashboard', height: '125px' },
      { story: 'HoursDashboardCard/HoursSummary', height: '75px' },
    ]) {
      test(`${story} retains the standard height while loading`, async ({ page, mount }) => {
        const component = await mount(story);
        const card = component.locator('.dashboard-card');
        await expect(card).toHaveCSS('height', height);

        if (story === 'DashboardCard/LoadingAndOverflow') await component.getByRole('button', { name: 'Toggle loading' }).click();
        else await page.evaluate(story => window.mount({ story, props: { loading: true } }), story);
        await expect(component.getByRole('status').first()).toBeVisible();
        await expect(card).toHaveCSS('height', height);
      });
    }

    test('scrolls overflowing notes inside the card and preserves its header when loading', async ({ mount }) => {
      const component = await mount('DashboardCard/LoadingAndOverflow');
      const card = component.locator('.dashboard-card');
      const content = component.locator('.dashboard-card__content');
      const heading = component.getByRole('heading', { name: 'Notes' });
      const originalHeader = await heading.boundingBox();

      await expect(content).toHaveCSS('overflow-y', 'auto');
      expect(await content.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
      await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
      expect(await content.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
      expect(await heading.boundingBox()).toEqual(originalHeader);

      await component.getByRole('button', { name: 'Toggle loading' }).click();
      await expect(component.getByRole('status', { name: 'Loading notes…' })).toBeVisible();
      await expect(card).toHaveCSS('height', '125px');
      expect(await heading.boundingBox()).toEqual(originalHeader);
    });

    test('keeps management table rows visible below their sticky headers', async ({ mount }) => {
      const component = await mount('ProgramTable/ManagementTables');

      for (const name of ['Programs', 'Cycles']) {
        const table = component.getByRole('table', { name, exact: true });
        await expect(table.getByRole('row')).toHaveCount(2);
        const geometry = await table.evaluate(element => ({
          viewport: element.closest('.table-wrapper')!.clientHeight,
          header: element.querySelector('thead')!.getBoundingClientRect().height,
          row: element.querySelector('tbody tr')!.getBoundingClientRect().height,
        }));
        expect(geometry.viewport).toBeGreaterThanOrEqual(geometry.header + geometry.row);
      }
    });
  });
}
