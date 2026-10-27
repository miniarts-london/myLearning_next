import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNotFound, login, MOODLE, resetMoodle } from './helpers';

// The teachers' Assignments tab (course 2), and each assignment's submissions in a drawer.
// "Assignment: Accessibility audit" (out of 10): Priya has submitted, Tom has a draft, Lena has
// submitted and has 8, Sam and Ben haven't submitted.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

async function loginAs(page: Page, username: 'student' | 'teacher') {
  await login(page, username);
  await expect(page).toHaveURL(/\/dashboard$/);
}

// The drawer for the audit, and the submissions table in it.
const drawer = (page: Page) => page.getByRole('dialog', { name: 'Assignment: Accessibility audit' });
const table = (page: Page) => drawer(page).getByRole('table', { name: 'Submissions for Assignment: Accessibility audit' });
const row = (page: Page, name: string) => table(page).getByRole('row', { name: new RegExp(name) });
const AUDIT = '/courses/2/submissions?assignment=13';

// The course-wide page: every assignment in course 2. The audit (due in 4 days): Priya and Lena
// submitted, Lena graded. The semantic HTML review (3 days overdue): Priya and Tom submitted,
// Priya graded.
const overview = (page: Page) => page.getByRole('table', { name: 'Submissions for each assignment in Accessible Web Design' });
const assignmentRow = (page: Page, name: string) => overview(page).getByRole('row', { name: new RegExp(name) });

test('a teacher opens the Assignments tab and sees every assignment', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2');
  // Tabs at the top of the course: Syllabus (this page), Students, Assignments.
  const tabs = page.getByRole('navigation', { name: 'Course pages' });
  await expect(tabs.getByRole('link')).toHaveText(['Syllabus', 'Students', 'Assignments']);
  await expect(tabs.getByRole('link', { name: 'Syllabus' })).toHaveAttribute('aria-current', 'page');
  await tabs.getByRole('link', { name: 'Assignments' }).click();

  await expect(page).toHaveURL(/\/courses\/2\/submissions$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Accessible Web Design' })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Assignments' })).toHaveAttribute('aria-current', 'page');
  const review = assignmentRow(page, 'Semantic HTML review');
  await expect(review).toContainText('2 of 5');
  await expect(review.getByRole('cell').nth(2)).toHaveText('1'); // To grade (the name is a row header, not a cell)
  await expect(review.getByRole('cell').nth(3)).toHaveText('1'); // Graded
  await expect(review).toContainText('Overdue');
  const audit = assignmentRow(page, 'Accessibility audit');
  await expect(audit).toContainText('2 of 5');
  await expect(audit).not.toContainText('Overdue'); // Not due yet

  // Same amount to grade, so the one due first comes first.
  const names = await overview(page).getByRole('rowheader').allTextContents();
  expect(names).toEqual(['Assignment: Semantic HTML review', 'Assignment: Accessibility audit']);

  // Each assignment opens its submissions in a drawer; the address says which, and Back closes it.
  await overview(page).getByRole('button', { name: 'Assignment: Accessibility audit' }).click();
  await expect(drawer(page)).toBeVisible();
  await expect(page).toHaveURL(/\/courses\/2\/submissions\?assignment=13$/);
  await expect(row(page, 'Priya Shah')).toContainText('Submitted');
  await page.goBack();
  await expect(drawer(page)).toBeHidden();
  await expect(page).toHaveURL(/\/courses\/2\/submissions$/);

  // Clicking anywhere on a row works too, and the close button closes it.
  await assignmentRow(page, 'Semantic HTML review').getByRole('cell').first().click();
  const reviewDrawer = page.getByRole('dialog', { name: 'Assignment: Semantic HTML review' });
  await expect(reviewDrawer.getByRole('row', { name: /Priya Shah/ })).toContainText('15 / 20');
  await reviewDrawer.getByRole('button', { name: 'Close submissions' }).click();
  await expect(reviewDrawer).toBeHidden();
});

test('switching tabs keeps the breadcrumb and course name in place: only the page below changes', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2');
  const title = page.getByRole('heading', { level: 1, name: 'Accessible Web Design' });
  await title.evaluate((el) => { (el as HTMLElement & { kept?: boolean }).kept = true; });
  const tabs = page.getByRole('navigation', { name: 'Course pages' });

  for (const [tab, url] of [['Students', /\/learners$/], ['Assignments', /\/submissions$/], ['Syllabus', /\/courses\/2$/]] as const) {
    await tabs.getByRole('link', { name: tab }).click();
    await expect(page).toHaveURL(url);
    await expect(tabs.getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    // The very same heading element: it wasn't reloaded.
    expect(await title.evaluate((el) => (el as HTMLElement & { kept?: boolean }).kept)).toBe(true);
  }
});

test('grading a submission updates the course-wide counts', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto(AUDIT);
  await page.getByRole('button', { name: "View and grade Priya Shah's submission" }).click();
  const dialog = page.getByRole('dialog', { name: 'Priya Shah' });
  await dialog.getByLabel(/Grade \(out of 10\)/).fill('9');
  await dialog.getByRole('button', { name: 'Save grade' }).click();
  await expect(dialog).toBeHidden();

  // The table behind the drawer is updated without leaving the page.
  await drawer(page).getByRole('button', { name: 'Close submissions' }).click();
  const audit = assignmentRow(page, 'Accessibility audit');
  await expect(audit.getByRole('cell').nth(2)).toHaveText('0'); // To grade
  await expect(audit.getByRole('cell').nth(3)).toHaveText('2'); // Graded
});

test('site admins get the tabs too; students get none, and "not found"', async ({ page }) => {
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/courses/2');
  await page.getByRole('navigation', { name: 'Course pages' }).getByRole('link', { name: 'Assignments' }).click();
  await expect(overview(page)).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, 'student');
  await page.goto('/courses/2');
  await expect(page.getByRole('heading', { level: 1, name: 'Accessible Web Design' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course pages' })).toHaveCount(0); // No tabs for students
  await page.goto('/courses/2/submissions');
  await expectNotFound(page);
});

test('the course-wide page passes the accessibility checks', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/submissions');
  await expect(overview(page)).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test("from an assignment's page, Submissions opens the drawer on the Assignments tab", async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13');
  await page.getByRole('link', { name: 'Submissions', exact: true }).click();

  await expect(page).toHaveURL(/\/courses\/2\/submissions\?assignment=13$/);
  await expect(drawer(page)).toBeVisible();
  await expect(row(page, 'Priya Shah')).toContainText('Submitted');
  await expect(row(page, 'Priya Shah')).toContainText('Not graded');
  await expect(row(page, 'Tom Okafor')).toContainText('Draft');
  await expect(row(page, 'Lena Fischer')).toContainText('8 / 10');
  await expect(row(page, 'Ben Carter')).toContainText('Not submitted');
  await expect(table(page)).not.toContainText('Tess Teacher'); // Not the teacher herself

  // "To grade": submitted and not graded yet.
  await page.getByRole('button', { name: /To grade/ }).click();
  await expect(drawer(page).getByRole('status').filter({ hasText: 'Showing' })).toHaveText('Showing 1 of 5');
  await expect(row(page, 'Priya Shah')).toBeVisible();
});

test("a teacher reads a student's work and grades it with feedback", async ({ page, request }) => {
  await loginAs(page, 'teacher');
  await page.goto(AUDIT);
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

test('the drawer passes the accessibility checks, with the grading dialog open too', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto(AUDIT);
  await expect(table(page)).toBeVisible();
  const tags = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: "View and grade Lena Fischer's submission" }).click();
  await expect(page.getByRole('dialog', { name: 'Lena Fischer' })).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
});

test('the old address of an assignment\'s submissions leads to the drawer; students get "not found"', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2/activities/13/submissions');
  await expect(page).toHaveURL(/\/courses\/2\/submissions\?assignment=13$/);
  await expect(drawer(page)).toBeVisible();

  await page.context().clearCookies();
  await loginAs(page, 'student');
  await page.goto('/courses/2/activities/13/submissions');
  await expectNotFound(page);
});

test('an activity opened from the syllabus loads under the same course name and tabs', async ({ page }) => {
  await loginAs(page, 'teacher');
  await page.goto('/courses/2');
  const title = page.getByRole('heading', { level: 1, name: 'Accessible Web Design' });
  await title.evaluate((el) => { (el as HTMLElement & { kept?: boolean }).kept = true; });
  await page.getByRole('region', { name: 'Why accessibility matters' }).getByRole('link', { name: 'Accessibility and WCAG' }).click();

  await expect(page).toHaveURL(/\/courses\/2\/activities\/11$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Accessibility and WCAG' })).toBeVisible();
  const syllabus = page.getByRole('navigation', { name: 'Course pages' }).getByRole('link', { name: 'Syllabus' });
  await expect(syllabus).toHaveAttribute('aria-current', 'true'); // Still in the Syllabus tab
  expect(await title.evaluate((el) => (el as HTMLElement & { kept?: boolean }).kept)).toBe(true); // Not reloaded

  await syllabus.click();
  await expect(page).toHaveURL(/\/courses\/2$/);
  await expect(syllabus).toHaveAttribute('aria-current', 'page');

  // "< Back" above the activity's title also returns to the syllabus, from the course index too.
  await page.locator('#course-index').getByRole('link', { name: 'Use the right element' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Use the right element' })).toBeVisible();
  expect(await title.evaluate((el) => (el as HTMLElement & { kept?: boolean }).kept)).toBe(true); // Not reloaded
  await page.getByRole('link', { name: 'Back to the syllabus' }).click();
  await expect(page).toHaveURL(/\/courses\/2$/);
  await expect(page.getByRole('region', { name: 'Why accessibility matters' })).toBeVisible();
  expect(await title.evaluate((el) => (el as HTMLElement & { kept?: boolean }).kept)).toBe(true);
});
