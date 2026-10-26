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

test("teachers don't get a learner's submission box or Mark as done buttons", async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13'); // The assignment
  await expect(page.getByRole('heading', { level: 1, name: 'Assignment: Accessibility audit' })).toBeVisible();
  await expect(page.getByText('Audit a web page against five WCAG criteria.')).toBeVisible(); // The assignment itself still shows
  await expect(page.getByRole('region', { name: 'Your submission' })).toHaveCount(0);
  // Instead: a link to Moodle's grading page for this assignment, in a new tab.
  const grade = page.getByRole('link', { name: /View and grade submissions/ });
  await expect(grade).toHaveAttribute('href', /\/mod\/assign\/view\.php\?id=13&action=grading$/);
  await expect(grade).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: /Mark as done|Done/ })).toHaveCount(0);

  await page.goto('/courses/2');
  await expect(page.getByRole('heading', { level: 1, name: 'Accessible Web Design' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mark as done|Done/ })).toHaveCount(0);
});

const suggestion = (page: Page, text: string) =>
  page.getByRole('dialog', { name: 'Assistant' }).getByRole('button', { name: text });
const openAssistant = (page: Page) => page.getByRole('button', { name: 'Assistant' }).click();

test("the assistant suggests teachers' questions to teachers", async ({ page }) => {
  await loginAs(page, 'teacher');
  await openAssistant(page);
  await expect(suggestion(page, 'Which assignments are set in my courses?')).toBeVisible();
  await expect(suggestion(page, 'How am I doing in my courses?')).toHaveCount(0);

  await page.goto('/courses/2'); // A course they teach
  await openAssistant(page);
  await expect(suggestion(page, 'What does this course cover, section by section?')).toBeVisible();
  await expect(suggestion(page, 'What are the main ideas of this course?')).toHaveCount(0);
});

test("the assistant suggests learners' questions to learners", async ({ page }) => {
  await loginAs(page, 'student');
  await openAssistant(page);
  await expect(suggestion(page, 'How am I doing in my courses?')).toBeVisible();
  await expect(suggestion(page, 'Which assignments are set in my courses?')).toHaveCount(0);
});
