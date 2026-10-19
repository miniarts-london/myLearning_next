import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { loginAsStudent, resetMoodle } from './helpers';

// Automated WCAG 2.2 A and AA checks with axe. They catch roughly a third of accessibility
// problems (contrast, missing labels, ARIA mistakes…); keyboard and screen reader checks are still needed.
const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

test('the login page', async ({ page }) => {
  await page.goto('/login');
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  expect(results.violations).toEqual([]);
});

test.describe('logged-in pages', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetMoodle(request);
    await loginAsStudent(page);
  });

  for (const path of ['/dashboard', '/catalogue', '/courses/2', '/courses/2/activities/11', '/courses/2/activities/13']) {
    test(path, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page })
        .withTags(WCAG)
        .exclude('img[src=""]') // The mock Moodle has no activity icons
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
