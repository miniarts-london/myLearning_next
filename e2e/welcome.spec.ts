import { expect, test } from '@playwright/test';
import { login, resetMoodle } from './helpers';

// The login page's demo buttons, and the welcome animation after logging in.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

test('the Teacher and Student demo buttons log in as those accounts', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Teacher' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('banner')).toContainText('Tess Teacher');

  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('button', { name: 'Student' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('banner')).toContainText('Sam Student');
});

test.describe('with animation allowed', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('after logging in, the horse says welcome, then leaves the page to you', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    const greeting = page.getByText('Welcome back, Sam', { exact: true }).last(); // The intro's, over the page's heading
    await expect(page.locator('p', { hasText: 'Welcome back, Sam' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Welcome back, Sam' })).toHaveCount(0, { timeout: 6000 });
    await expect(greeting).toBeVisible(); // The dashboard's own heading stays
    await expect(page.getByRole('button', { name: 'Assistant' })).toBeVisible();

    // Only once: not again on the next page.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Welcome back, Sam' })).toHaveCount(0);
  });

  test('clicking skips the welcome', async ({ page }) => {
    await login(page);
    const intro = page.locator('p', { hasText: 'Welcome back, Sam' });
    await expect(intro).toBeVisible();
    await intro.click();
    await expect(intro).toHaveCount(0);
  });
});

test('with reduced motion, there is no welcome animation', async ({ page }) => {
  await login(page); // The test setup prefers reduced motion
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('p', { hasText: 'Welcome back, Sam' })).toBeHidden();
});
