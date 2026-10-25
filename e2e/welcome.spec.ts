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

  test("the page stays hidden until the horse has landed, even if the server re-renders the page", async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Student' }).click();
    const intro = page.locator('p', { hasText: 'Welcome back, Sam' });
    await expect(intro).toBeVisible();
    // What production does right after logging in: Next.js fetches the page from the server again.
    await page.evaluate(() => (window as unknown as { next: { router: { refresh: () => void } } }).next.router.refresh());
    await page.waitForTimeout(800);
    await expect(intro).toBeVisible(); // Still playing…
    expect(await page.locator('header').evaluate((el) => getComputedStyle(el).opacity)).toBe('0'); // …and the page still hidden
    // Then it finishes: the page appears, and the intro doesn't come back.
    await expect(intro).toHaveCount(0, { timeout: 8000 });
    await expect.poll(() => page.locator('header').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
    await page.evaluate(() => (window as unknown as { next: { router: { refresh: () => void } } }).next.router.refresh());
    await page.waitForTimeout(800);
    await expect(intro).toHaveCount(0);
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
