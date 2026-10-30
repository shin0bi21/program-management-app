import { expect, test } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`keeps label spacing consistent across inputs, dates, selects and checklists at ${width}px`, async ({ page, mount }) => {
    await page.setViewportSize({ width, height: 800 });
    const component = await mount('FormFieldGroup/StandardFields');
    const fields = component.locator('.form-field, .form-field-group');
    const layouts = await fields.evaluateAll(elements => elements.map(field => {
      const title = field.firstElementChild!;
      const control = title.nextElementSibling!;
      const titleStyle = getComputedStyle(title);

      return {
        gap: control.getBoundingClientRect().top - title.getBoundingClientRect().bottom,
        fontSize: titleStyle.fontSize,
        fontWeight: titleStyle.fontWeight,
        color: titleStyle.color,
        bottomSpacing: getComputedStyle(field).marginBottom,
      };
    }));

    expect(layouts).toHaveLength(4);
    for (const layout of layouts) {
      expect(layout.gap).toBe(4);
      expect(layout).toEqual(layouts[0]);
    }

    const checkbox = component.getByRole('checkbox', { name: 'Spring 2026' });
    await expect(checkbox).toHaveCSS('width', '18px');
    await expect(checkbox).toHaveCSS('height', '18px');
    await checkbox.click();
    await expect(checkbox).toBeChecked();
  });
}
