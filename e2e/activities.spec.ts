import { expect, test } from '@playwright/test';
import { courseSection, expectNotFound, loginAsStudent, resetMoodle } from './helpers';

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

test('activities open inside the app, not in Moodle', async ({ page }) => {
  await page.goto('/courses/2');
  await courseSection(page, 'Why accessibility matters').getByRole('link', { name: 'Accessibility and WCAG' }).click();
  await expect(page).toHaveURL(/\/courses\/2\/activities\/11$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Accessibility and WCAG');
  await expect(page.getByRole('article')).toContainText('WCAG has four principles.');
});

test('links in Moodle content stay in the app; other sites open in a new tab', async ({ page }) => {
  await page.goto('/courses/2/activities/11');
  const article = page.getByRole('article');
  // A Moodle activity link is rewritten to the app, then redirected to the right course.
  await article.getByRole('link', { name: 'the audit' }).click();
  await expect(page).toHaveURL(/\/courses\/2\/activities\/13$/);

  await page.goto('/courses/2/activities/11');
  await expect(page.getByRole('article').getByRole('link', { name: 'the W3C site' })).toHaveAttribute('target', '_blank');
});

test('Previous and Next move through the course in order, skipping labels and hidden items', async ({ page }) => {
  await page.goto('/courses/2/activities/11');
  const pager = page.getByRole('navigation', { name: 'Activities in this course' });
  await expect(pager.getByRole('link', { name: /Previous/ })).toHaveCount(0);

  const expected = ['WCAG overview (W3C)', 'Assignment: Accessibility audit', 'Use the right element', 'Semantics quiz'];
  for (const name of expected) {
    await pager.getByRole('link', { name: /Next/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  await expect(pager.getByRole('link', { name: /Next/ })).toHaveCount(0);

  await pager.getByRole('link', { name: /Previous/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Use the right element');
  await pager.getByRole('link', { name: 'Back to course' }).click();
  await expect(page).toHaveURL(/\/courses\/2$/);
});

test('a URL activity offers the outside site in a new tab', async ({ page }) => {
  await page.goto('/courses/2/activities/12');
  const open = page.getByRole('link', { name: /Open www\.w3\.org/ });
  await expect(open).toHaveAttribute('href', 'https://www.w3.org/WAI/standards-guidelines/wcag/');
  await expect(open).toHaveAttribute('target', '_blank');
});

test('an assignment shows its due date and sends submissions to Moodle in a new tab', async ({ page }) => {
  await page.goto('/courses/2/activities/13');
  await expect(page.getByText(/^Due /)).toBeVisible();
  await expect(page.getByRole('article')).toContainText('Audit a web page against five WCAG criteria.');
  await expect(page.getByRole('link', { name: /Submit in Moodle/ })).toHaveAttribute('target', '_blank');
});

test("activity types the app can't show yet link to Moodle", async ({ page }) => {
  await page.goto('/courses/2/activities/22');
  await expect(page.getByText("This type of activity (quiz) isn't available in this app yet.")).toBeVisible();
  await expect(page.getByRole('link', { name: /Open in Moodle/ })).toHaveAttribute('href', /\/mod\/quiz\/view\.php\?id=22$/);
});

test('hidden activities are "not found"', async ({ page }) => {
  await page.goto('/courses/2/activities/23');
  await expectNotFound(page);
});

test('Mark as done works on the activity page too', async ({ page }) => {
  await page.goto('/courses/2/activities/21');
  const article = page.getByRole('main');
  await article.getByRole('button', { name: 'Mark as done for Use the right element' }).click();
  await expect(article.getByRole('button', { name: 'Done – Use the right element. Select to mark as not done' })).toBeVisible();
});
