import { expect, test } from '@playwright/test';
import { loginAsStudent, MOODLE, resetMoodle } from './helpers';

// Course images and other Moodle files, through /api/file.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

// True once the browser has actually decoded and drawn the image.
const loaded = (img: import('@playwright/test').Locator) =>
  img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);

test("courses without an uploaded image show the default picture", async ({ page }) => {
  // Course 2 has Moodle's inline pattern, course 3 its generated pattern file: both count as no image.
  const img = page.getByRole('main').getByRole('article').filter({ hasText: 'Accessible Web Design' }).locator('img');
  await expect(img).toHaveAttribute('src', '/images/course-default.jpg');
  await expect.poll(() => loaded(img)).toBe(true);

  await page.goto('/catalogue');
  const horse = page.getByRole('main').getByRole('article').filter({ hasText: 'Horse Care Essentials' }).locator('img');
  await expect(horse).toHaveAttribute('src', '/images/course-default.jpg');
  await expect.poll(() => loaded(horse)).toBe(true);
});

test("Moodle's generated placeholder file can still be fetched through /api/file", async ({ page }) => {
  const generated = `${MOODLE}/pluginfile.php/42/course/generated/course.svg`;
  const response = await page.request.get(`/api/file?url=${encodeURIComponent(generated)}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/svg+xml');
});

test('an uploaded SVG is still a download, never shown as a page', async ({ page }) => {
  const evil = `${MOODLE}/pluginfile.php/5/mod_forum/attachment/evil.svg`;
  const response = await page.request.get(`/api/file?url=${encodeURIComponent(evil)}`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('application/octet-stream');
  expect(response.headers()['content-disposition']).toMatch(/^attachment/);
  expect(response.headers()['content-security-policy']).toContain('sandbox');
});

test('files from anywhere but Moodle are refused', async ({ page }) => {
  const response = await page.request.get(`/api/file?url=${encodeURIComponent('https://evil.example/pluginfile.php/1/x.png')}`);
  expect(response.status()).toBe(400);
});
