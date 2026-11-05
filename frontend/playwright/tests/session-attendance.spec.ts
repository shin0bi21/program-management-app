import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`selects youth beyond the first batch inside the attendance modal at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('SessionAttendanceModal/OpenAttendance');
    const dialog = component.getByRole('dialog', { name: 'Attendance' });
    const search = dialog.getByRole('searchbox', { name: 'Search Youth attendance' });
    await expect(dialog.getByRole('checkbox', { name: 'Person 01' })).toBeChecked();

    await search.fill('Person 60');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Clear search' })).toBeFocused();
    await page.keyboard.press('Tab');
    const last = dialog.getByRole('checkbox', { name: 'Person 60' });
    await expect(last).toBeFocused();
    await page.keyboard.press('Space');
    await expect(last).toBeChecked();

    await search.fill('Person 01');
    await expect(dialog.getByRole('checkbox', { name: 'Person 01' })).toBeChecked();
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
  });
}
