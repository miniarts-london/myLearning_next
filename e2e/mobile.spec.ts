import { expect, test } from '@playwright/test';
import { loginAsStudent, resetMoodle } from './helpers';

// Runs in the "mobile" project (a phone-sized screen); see playwright.config.ts.
// On a phone the course index is a modal drawer, which MUI exposes as a dialog named "Course index".

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

test('on a phone, the course index is a drawer that closes when you pick an activity', async ({ page }) => {
  await page.goto('/courses/2');
  await expect(page.locator('#course-index')).toBeHidden(); // No sidebar on a phone

  await page.getByRole('button', { name: 'Course index' }).click();
  const drawer = page.getByRole('dialog', { name: 'Course index' });
  await expect(drawer).toBeVisible();

  await drawer.getByRole('link', { name: /Semantics quiz/ }).click();
  await expect(page).toHaveURL(/\/activities\/22$/);
  await expect(drawer).toBeHidden();
});

test('the drawer has a close button', async ({ page }) => {
  await page.goto('/courses/2');
  await page.getByRole('button', { name: 'Course index' }).click();
  const drawer = page.getByRole('dialog', { name: 'Course index' });
  await expect(drawer).toBeVisible();
  await page.getByRole('button', { name: 'Close course index' }).click();
  await expect(drawer).toBeHidden();
});

for (const path of ['/dashboard', '/catalogue', '/courses/2', '/courses/2/activities/11']) {
  test(`${path} fits the screen without sideways scrolling`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}
