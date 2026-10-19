import { expect, test } from '@playwright/test';
import { courseIndex, loginAsStudent, resetMoodle } from './helpers';

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

test('lists sections and activities with completion, leaving out labels and hidden items', async ({ page }) => {
  await page.goto('/courses/2');
  const index = courseIndex(page);
  await expect(index.getByRole('button', { name: 'Why accessibility matters' })).toBeVisible();
  await expect(index.getByRole('button', { name: 'Semantic HTML' })).toBeVisible();
  await expect(index.getByRole('link', { name: /Accessibility and WCAG/ })).toContainText('Done');
  await expect(index.getByRole('link', { name: /Use the right element/ })).toContainText('To do');
  await expect(index.getByRole('link', { name: /WCAG overview/ })).not.toContainText(/Done|To do/); // Not tracked
  await expect(index).not.toContainText('Intro label');
  await expect(index).not.toContainText('Hidden');
});

test('highlights the current activity and moves with you', async ({ page }) => {
  await page.goto('/courses/2');
  const index = courseIndex(page);
  await index.getByRole('link', { name: /Use the right element/ }).click();
  await expect(page).toHaveURL(/\/activities\/21$/);
  await expect(index.locator('[aria-current="page"]')).toContainText('Use the right element');
  await index.getByRole('link', { name: 'Accessible Web Design' }).click();
  await expect(page).toHaveURL(/\/courses\/2$/);
});

test('sections open and close', async ({ page }) => {
  await page.goto('/courses/2');
  const index = courseIndex(page);
  const section = index.getByRole('button', { name: 'Why accessibility matters' });
  const activity = index.getByRole('link', { name: /Accessibility and WCAG/ });

  await expect(section).toHaveAttribute('aria-expanded', 'true');
  await section.click();
  await expect(section).toHaveAttribute('aria-expanded', 'false');
  await expect(activity).toBeHidden();
  await section.click();
  await expect(activity).toBeVisible();
});

test('the index can be hidden, stays hidden after a reload, and comes back', async ({ page }) => {
  await page.goto('/courses/2');
  const toggle = page.getByRole('button', { name: /course index/i });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('button', { name: 'Hide course index' }).click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#course-index')).toBeHidden();

  await page.reload();
  await expect(page.locator('#course-index')).toBeHidden();

  await page.getByRole('button', { name: 'Course index' }).click();
  await expect(courseIndex(page)).toBeVisible();
});

test("while hidden, the index's links can't be reached with the keyboard", async ({ page }) => {
  await page.goto('/courses/2');
  await page.getByRole('button', { name: 'Hide course index' }).click();
  await expect(page.locator('#course-index')).toBeHidden();
  await page.getByRole('button', { name: 'Course index' }).focus();
  await page.keyboard.press('Shift+Tab');
  const inIndex = await page.evaluate(() => !!document.activeElement?.closest('#course-index'));
  expect(inIndex).toBe(false);
});
