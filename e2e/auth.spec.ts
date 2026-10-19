import { expect, test } from '@playwright/test';
import { login, loginAsStudent, resetMoodle } from './helpers';

test.beforeEach(async ({ request }) => resetMoodle(request));

test('pages need a login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /MyLearning/ })).toBeVisible();
});

test('empty fields are caught before asking Moodle', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Enter your username and password.');
});

test("a wrong password shows Moodle's own message and keeps the username", async ({ page }) => {
  await login(page, 'student', 'wrong');
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Invalid login, please try again');
  await expect(page.getByLabel('Username')).toHaveValue('student');
  await expect(page).toHaveURL(/\/login$/);
});

test('logging in shows the dashboard, logging out goes back to the login page', async ({ page }) => {
  await loginAsStudent(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back, Sam');
  await expect(page.getByRole('banner')).toContainText('Sam Student');

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/); // The session really is gone.
});

test('the Moodle token never reaches the browser', async ({ page, context }) => {
  await loginAsStudent(page);
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === 'mylearning_session');
  expect(session?.httpOnly).toBe(true);
  expect(session?.value).not.toContain('test-token'); // Encrypted, not just encoded.
  expect(await page.content()).not.toContain('test-token');
});
