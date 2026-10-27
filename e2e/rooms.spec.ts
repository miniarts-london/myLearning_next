import { expect, test } from '@playwright/test';
import { login, resetMoodle } from './helpers';

// Classrooms: seating plans kept in the app's own Postgres database (here a throwaway one).

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

test('a teacher creates a room, and it is still there after a reload', async ({ page }) => {
  await login(page, 'teacher');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/room-layout');
  await expect(page.getByRole('heading', { level: 1, name: 'Classrooms' })).toBeVisible();

  const name = `Parents evening ${Date.now()}`; // The database lives as long as the test server
  const newRoom = page.getByRole('button', { name: 'Create new room' });
  if (await newRoom.isVisible()) await newRoom.click();
  await page.getByLabel('Room name').fill(name);
  await page.getByRole('radio', { name: 'A meeting' }).check();
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
});
