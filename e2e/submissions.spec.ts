import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNotFound, login, MOODLE, resetMoodle } from './helpers';

// The teachers' Submissions page for an assignment (course 2, "Assignment: Accessibility audit",
// out of 10). Priya has submitted, Tom has a draft, Lena has submitted and has 8, Sam and Ben
// haven't submitted.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

async function loginAs(page: Page, username: 'student' | 'teacher') {
  await login(page, username);
  await expect(page).toHaveURL(/\/dashboard$/);
}

const table = (page: Page) => page.getByRole('table', { name: /Submissions for/ });
const row = (page: Page, name: string) => table(page).getByRole('row', { name: new RegExp(name) });

test('a teacher opens Submissions from the assignment and sees who has handed in', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13');
  await page.getByRole('link', { name: 'Submissions', exact: true }).click();

  await expect(page).toHaveURL(/\/courses\/2\/activities\/13\/submissions$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Submissions' })).toBeVisible();
  await expect(row(page, 'Priya Shah')).toContainText('Submitted');
  await expect(row(page, 'Priya Shah')).toContainText('Not graded');
  await expect(row(page, 'Tom Okafor')).toContainText('Draft');
  await expect(row(page, 'Lena Fischer')).toContainText('8 / 10');
  await expect(row(page, 'Ben Carter')).toContainText('Not submitted');
  await expect(table(page)).not.toContainText('Tess Teacher'); // Not the teacher herself

  // "To grade": submitted and not graded yet.
  await page.getByRole('button', { name: /To grade/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 1 of 5');
  await expect(row(page, 'Priya Shah')).toBeVisible();
});

test("a teacher reads a learner's work and grades it with feedback", async ({ page, request }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13/submissions');
  await page.getByRole('button', { name: "View and grade Priya Shah's submission" }).click();

  const dialog = page.getByRole('dialog', { name: 'Priya Shah' });
  await expect(dialog).toContainText('I checked the contrast, headings and alt text.');
  expect(await dialog.locator('script').count()).toBe(0); // Their HTML is cleaned

  // Out of range first: the browser stops it (the field allows 0–10), so nothing is sent.
  const gradeField = dialog.getByLabel(/Grade \(out of 10\)/);
  await gradeField.fill('12');
  await dialog.getByRole('button', { name: 'Save grade' }).click();
  expect(await gradeField.evaluate((el: HTMLInputElement) => el.validity.rangeOverflow)).toBe(true);
  await expect(dialog).toBeVisible();
  expect((await (await request.get(`${MOODLE}/__grades`)).json())['21']).toBeUndefined();

  await dialog.getByLabel(/Grade \(out of 10\)/).fill('9.5');
  await dialog.getByLabel('Feedback (optional)').fill('Great detail on the contrast checks.');
  await dialog.getByRole('button', { name: 'Save grade' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: 'Priya Shah: Saved: 9.5 / 10.' })).toBeVisible();
  await expect(row(page, 'Priya Shah')).toContainText('9.5 / 10');

  const grades = await (await request.get(`${MOODLE}/__grades`)).json();
  expect(grades['21']).toEqual({ grade: 9.5, feedback: 'Great detail on the contrast checks.' });
});

test('the page passes the accessibility checks, with the dialog open too', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13/submissions');
  await expect(table(page)).toBeVisible();
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: "View and grade Lena Fischer's submission" }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
});

test('students get "not found"', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/courses/2/activities/13/submissions');
  await expectNotFound(page);
});
