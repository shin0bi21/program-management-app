import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`searchable select handles portalled focus, navigation, selection and cancellation at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('FloatingSelect/Searchable');
    const trigger = component.getByRole('button', { name: 'Timezone', exact: true });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    const search = page.getByRole('combobox', { name: 'Search Timezone' });
    await expect(search).toBeFocused();
    await expect(component.getByRole('dialog')).toHaveCount(0);

    await search.fill('TIMEZONE 8');
    await expect(page.getByRole('option')).toHaveCount(2);
    await expect(component.getByLabel('Selected value')).toHaveText('0');
    await page.keyboard.press('ArrowDown');
    await expect(search).toBeFocused();
    const activeId = await search.getAttribute('aria-activedescendant');
    await expect(page.getByRole('option', { name: 'Timezone 80', exact: true })).toHaveAttribute('id', activeId!);
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveText('Timezone 80');
    await expect(trigger).toBeFocused();
    await expect(component.getByLabel('Selected value')).toHaveText('79');

    await trigger.click();
    await expect(search).toHaveValue('');
    await expect(page.getByRole('option', { name: 'Timezone 80', exact: true })).toBeInViewport();
    await search.fill('unknown timezone');
    await expect(page.getByRole('dialog').getByRole('status')).toHaveText('No matching options.');
    await page.keyboard.press('Enter');
    await expect(search).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveText('Timezone 80');

    await trigger.click();
    await search.fill('Timezone 12');
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(search).toBeFocused();
    await expect(search).toHaveValue('');
    await page.getByRole('option', { name: 'Timezone 2', exact: true }).click();
    await expect(trigger).toHaveText('Timezone 2');
    await expect(trigger).toBeFocused();
  });
}

test('keeps popup actions reachable by keyboard without selecting a value', async ({ page, mount }) => {
  const component = await mount('FloatingSelect/Searchable', { actions: true });
  const trigger = component.getByRole('button', { name: 'Timezone', exact: true });
  await trigger.click();
  const search = page.getByRole('combobox');
  await search.fill('Timezone 7');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Clear search' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Add timezone' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Edit Timezone 7', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(component.getByLabel('Last action')).toHaveText('6');
  await expect(component.getByLabel('Selected value')).toHaveText('0');
  await expect(trigger).toBeFocused();
});

test('Escape closes the dropdown without discarding its parent editor draft', async ({ page, mount }) => {
  const component = await mount('Modal/DropdownEditor');
  await component.getByRole('button', { name: 'Open editor' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor', exact: true });
  const name = editor.getByRole('textbox', { name: 'Name', exact: true });
  await name.fill('unsaved draft');
  const trigger = editor.getByRole('button', { name: 'Choice', exact: true });
  await trigger.click();

  await page.keyboard.press('Escape');

  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(name).toHaveValue('unsaved draft');
  await page.keyboard.press('Escape');
  await expect(editor).toHaveCount(0);
});
