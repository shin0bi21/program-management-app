import { expect, test } from '@playwright/test';

const taskItemStoryId = 'pages/Staff/Tasks/components/TaskCalendar/TaskItem/TaskItem/InteractiveTaskItem';

test('preserves the task status border when its action menu opens', async ({ mount }) => {
  const component = await mount(taskItemStoryId);
  const item = component.getByRole('button', { name: /Prepare workshop.*Open actions/ });
  const borderColor = await item.evaluate(element => getComputedStyle(element).borderTopColor);

  await item.click();

  await expect(item).toHaveAttribute('aria-expanded', 'true');
  await expect(item).toHaveCSS('border-top-color', borderColor);
});
