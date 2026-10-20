import { expect, test } from '@playwright/test';
import { courseSection, loginAsStudent, MOODLE, resetMoodle } from './helpers';

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

const upNext = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Up next' });

test('Up next groups deadlines from all courses, soonest first', async ({ page }) => {
  await loginAsStudent(page);
  const panel = upNext(page);

  const overdue = panel.getByRole('region', { name: 'Overdue' });
  await expect(overdue.getByRole('link', { name: 'Use the right element' })).toBeVisible();
  await expect(overdue).toContainText('Complete by');

  await expect(panel.getByRole('region', { name: 'Tomorrow' }).getByRole('link', { name: 'Semantics quiz' })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'This week' }).getByRole('link', { name: 'Assignment: Accessibility audit' })).toBeVisible();
  await expect(panel.getByRole('region', { name: 'Later' }).getByRole('link', { name: 'Final project' })).toBeVisible();

  // Soonest first: overdue, then tomorrow, then this week, then later.
  const order = await panel.getByRole('link').allTextContents();
  expect(order).toEqual(['Use the right element', 'Semantics quiz', 'Assignment: Accessibility audit', 'Final project']);

  // The course and the due date are shown too.
  await expect(panel).toContainText('Accessible Web Design');
  await expect(panel.locator('time').first()).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
});

test('Up next never shows deadlines from hidden courses', async ({ page }) => {
  await loginAsStudent(page);
  await expect(upNext(page).getByRole('link').first()).toBeVisible();
  await expect(upNext(page)).not.toContainText('Secret');
});

test('Up next links open the activity inside the app', async ({ page }) => {
  await loginAsStudent(page);
  await upNext(page).getByRole('link', { name: 'Semantics quiz' }).click();
  await expect(page).toHaveURL(/\/courses\/2\/activities\/22$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Semantics quiz');
});

test('finishing an activity takes it off Up next', async ({ page }) => {
  await loginAsStudent(page);
  await expect(upNext(page).getByRole('link', { name: 'Use the right element' })).toBeVisible();

  await page.goto('/courses/2');
  await courseSection(page, 'Semantic HTML').getByRole('button', { name: 'Mark as done for Use the right element' }).click();
  await expect(courseSection(page, 'Semantic HTML').getByRole('button', { name: /^Done – Use the right element/ })).toBeVisible();

  await page.goto('/dashboard');
  await expect(upNext(page).getByRole('link', { name: 'Semantics quiz' })).toBeVisible();
  await expect(upNext(page).getByRole('link', { name: 'Use the right element' })).toHaveCount(0);
  await expect(upNext(page).getByRole('region', { name: 'Overdue' })).toHaveCount(0);
});

test('if the calendar fails, the dashboard still shows your courses', async ({ page, request }) => {
  await request.post(`${MOODLE}/__calendar-down`);
  await loginAsStudent(page);
  await expect(upNext(page)).toContainText("Upcoming deadlines couldn't be loaded");
  await expect(page.getByRole('main').getByRole('heading', { name: 'Accessible Web Design' })).toBeVisible();
});
