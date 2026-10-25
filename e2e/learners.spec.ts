import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNotFound, login, MOODLE, resetMoodle } from './helpers';

// Log in and wait until it has finished (the session cookie is set), before going anywhere.
async function loginAs(page: Page, username: 'student' | 'teacher' | 'admin') {
  await login(page, username);
  await expect(page).toHaveURL(/\/dashboard$/);
}

// The learner list: for a course's teachers and for site admins, never for students.
// Course 2 has five learners (Sam, Priya, Tom, Lena and Ben: see e2e/mock-moodle.mjs) and a teacher.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

const learnersTable = (page: Page) => page.getByRole('table', { name: /Learners in Accessible Web Design/ });
const learnerNames = (page: Page) => learnersTable(page).getByRole('rowheader').allTextContents();

test('a teacher can open the learner list from the course page', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2');
  await page.getByRole('link', { name: 'Learners' }).click();

  await expect(page).toHaveURL(/\/courses\/2\/learners$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Learners' })).toBeVisible();
  // Learners only, not the teacher; sorted by name to start with.
  expect(await learnerNames(page)).toEqual(['Ben Carter', 'Lena Fischer', 'Priya Shah', 'Sam Student', 'Tom Okafor']);

  const row = (name: string) => learnersTable(page).getByRole('row', { name: new RegExp(name) });
  await expect(row('Priya Shah')).toContainText('4 of 4');
  await expect(row('Sam Student')).toContainText('1 of 4'); // Sam's own, live completion
  await expect(row('Ben Carter')).toContainText('Never');
  await expect(row('Priya Shah')).toContainText('Yesterday');
  await expect(page.getByRole('progressbar', { name: 'Tom Okafor: 2 of 4 activities done' })).toHaveAttribute('aria-valuenow', '50');
});

test('the list can be sorted and filtered', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/learners');

  // Progress: least first (who might need help), then most first.
  const progress = page.getByRole('button', { name: 'Progress' });
  await progress.click();
  await expect(page.getByRole('columnheader', { name: 'Progress' })).toHaveAttribute('aria-sort', 'ascending');
  expect((await learnerNames(page))[0]).toBe('Ben Carter');
  await progress.click();
  await expect(page.getByRole('columnheader', { name: 'Progress' })).toHaveAttribute('aria-sort', 'descending');
  expect((await learnerNames(page))[0]).toBe('Priya Shah');

  // Not visited in two weeks: Lena (20 days ago) and Ben (never).
  await page.getByRole('checkbox', { name: /haven't visited in 2 weeks/ }).check();
  await expect(page.getByRole('status')).toHaveText('Showing 2 of 5 learners');
  expect((await learnerNames(page)).sort()).toEqual(['Ben Carter', 'Lena Fischer']);
});

test('a site admin can see the learners of any course', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/courses/2');
  await page.getByRole('link', { name: 'Learners' }).click();
  await expect(learnersTable(page)).toBeVisible();
});

test('students get no link, and the page is "not found" for them', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/courses/2');
  await expect(page.getByRole('heading', { level: 1, name: 'Accessible Web Design' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Learners' })).toHaveCount(0);

  await page.goto('/courses/2/learners');
  await expectNotFound(page);
});

test('the learner list passes the accessibility checks', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/learners');
  await expect(learnersTable(page)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("site admins aren't listed, even when enrolled as students", async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/learners');
  await expect(learnersTable(page)).toBeVisible();
  expect(await learnerNames(page)).not.toContain('Ada Admin'); // id 2 = MOODLE_SUPPORT_USERID in the test setup
});

test("you don't appear in your own list, even when enrolled as a student", async ({ page }) => {
  await loginAs(page, 'teacher'); // Tess Teacher is also enrolled in course 2 as a student
  await page.goto('/courses/2/learners');
  await expect(learnersTable(page)).toBeVisible();
  expect(await learnerNames(page)).not.toContain('Tess Teacher');
});

test('selecting a name sends that learner a Moodle message', async ({ page, request }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/learners');
  await learnersTable(page).getByRole('button', { name: 'Priya Shah, send a message' }).click();

  const dialog = page.getByRole('dialog', { name: 'Message Priya Shah' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel(/Your message/)).toBeFocused();
  await dialog.getByLabel(/Your message/).fill('Great work finishing the course!');
  await dialog.getByRole('button', { name: 'Send' }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Message sent to Priya Shah.' })).toBeVisible();
  const messages = await (await request.get(`${MOODLE}/__messages`)).json();
  expect(messages).toEqual([{ from: 7, touserid: 21, text: 'Great work finishing the course!' }]);
});

test('the message dialog passes the accessibility checks', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/learners');
  await learnersTable(page).getByRole('button', { name: 'Tom Okafor, send a message' }).click();
  await expect(page.getByRole('dialog', { name: 'Message Tom Okafor' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test("teachers don't see a progress ring of their own on courses they teach", async ({ page }) => {
  await loginAs(page, 'teacher');
  const card = page.getByRole('main').getByRole('article').filter({ hasText: 'Accessible Web Design' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('progressbar')).toHaveCount(0);

  await page.goto('/courses/2');
  await expect(page.getByRole('heading', { level: 1, name: 'Accessible Web Design' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Course progress' })).toHaveCount(0);
});

test('learners still see their progress ring', async ({ page }) => {
  await loginAs(page, 'student');
  await expect(page.getByRole('progressbar', { name: 'Accessible Web Design progress' })).toBeVisible();
  await page.goto('/courses/2');
  await expect(page.getByRole('progressbar', { name: 'Course progress' })).toBeVisible();
});
