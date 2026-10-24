import { expect, test } from '@playwright/test';
import { loginAsStudent, resetMoodle } from './helpers';

// Long category descriptions show three lines, with "Show more" for the rest.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
  await page.goto('/catalogue');
});

test('a long category description opens and closes', async ({ page }) => {
  const section = page.getByRole('region', { name: 'Web Development' });
  const more = section.getByRole('button', { name: 'Show more about Web Development' });
  const text = section.getByText('Every course ends with a small project');

  await expect(more).toHaveAttribute('aria-expanded', 'false');
  // Cut off after three lines: the last paragraph is there but out of sight.
  const description = section.locator(`[id="${await more.getAttribute('aria-controls')}"]`);
  const closedHeight = (await description.boundingBox())!.height;
  expect(closedHeight).toBeLessThan(100);

  await more.click();
  await expect(section.getByRole('button', { name: 'Show less about Web Development' })).toHaveAttribute('aria-expanded', 'true');
  await expect(text).toBeInViewport();
  expect((await description.boundingBox())!.height).toBeGreaterThan(closedHeight);
});

test('a short description has no button', async ({ page }) => {
  const section = page.getByRole('region', { name: 'Personal Development' });
  await expect(section.getByText('Skills for everyday life.')).toBeVisible();
  await expect(section.getByRole('button', { name: /Show more/ })).toHaveCount(0);
});
