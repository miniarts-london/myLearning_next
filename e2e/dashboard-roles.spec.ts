import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login, resetMoodle } from './helpers';

// "Up next" on the dashboard: deadlines for learners, upcoming calendar events for teachers.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

async function loginAs(page: Page, username: 'student' | 'teacher') {
  await login(page, username);
  await expect(page).toHaveURL(/\/dashboard$/);
}

const upNext = (page: Page) => page.getByRole('region', { name: 'Up next' });

test("a teacher's Up next shows the upcoming events in their calendar", async ({ page }) => {
  await loginAs(page, 'teacher');
  const section = upNext(page);
  await expect(section).toBeVisible();
  await expect(section).toContainText('Live Q&A session');   // A course event (name decoded from Moodle)
  await expect(section).toContainText('Course event · Accessible Web Design');
  await expect(section).toContainText('Site maintenance');   // A site-wide event
  await expect(section).not.toContainText('Secret course');  // Hidden course: never shown
  // Activity events link to the activity in this app.
  await expect(section.getByRole('link', { name: 'Assignment: Accessibility audit is due' })).toHaveAttribute('href', '/courses/2/activities/13');
  // Not the learner's deadlines (those aren't a teacher's).
  await expect(section).not.toContainText('Overdue');
  await expect(page.getByRole('heading', { name: 'Upcoming events' })).toHaveCount(0);

  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('img[src=""]').analyze();
  expect(results.violations).toEqual([]);
});

test("a learner's Up next still shows their deadlines, not calendar events", async ({ page }) => {
  await loginAs(page, 'student');
  const section = upNext(page);
  await expect(section).toContainText('Use the right element'); // An overdue deadline
  await expect(section).not.toContainText('Live Q&A session');
});
