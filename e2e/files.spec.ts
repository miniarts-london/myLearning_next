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

test("a course with no image shows Moodle's inline placeholder pattern", async ({ page }) => {
  const img = page.getByRole('main').getByRole('article').filter({ hasText: 'Accessible Web Design' }).locator('img');
  await expect(img).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/);
  await expect.poll(() => loaded(img)).toBe(true);
});

test("Moodle's generated placeholder file is shown, through /api/file", async ({ page }) => {
  await page.goto('/catalogue');
  const img = page.getByRole('main').getByRole('article').filter({ hasText: 'Horse Care Essentials' }).locator('img');
  await expect(img).toHaveAttribute('src', /^\/api\/file\?url=/);
  await expect.poll(() => loaded(img)).toBe(true);
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
