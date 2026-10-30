import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`warning action stays usable at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 720 });
    const component = await mount('PageMessageOverlay/PageMessagesStory');
    const message = component.getByRole('status');
    await expect(message).toContainText('This table’s data is out of order.');

    const bounds = await message.boundingBox();
    if (!bounds) throw new Error('Message geometry unavailable');
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);

    const refresh = message.getByRole('button', { name: 'Refresh' });
    await refresh.click();
    await expect(refresh).toBeDisabled();
    await message.getByRole('button', { name: 'Dismiss page messages' }).click();
    await expect(message).toHaveCount(0);
  });
}

test('reports errors and warnings together with their own actions', async ({ mount }) => {
  const component = await mount('PageMessageOverlay/PageMessagesStory', { mixed: true });
  const message = component.getByRole('alert');
  await expect(message).toContainText('Could not load more records.');
  await expect(message.getByRole('button', { name: 'Retry' })).toBeVisible();
  await expect(message.getByRole('button', { name: 'Refresh' })).toBeVisible();
});
