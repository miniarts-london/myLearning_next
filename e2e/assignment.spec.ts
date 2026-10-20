import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { loginAsStudent, resetMoodle } from './helpers';

// Assignment 1 in the mock Moodle uses drafts and a submission statement, like many real courses.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
  await page.goto('/courses/2/activities/13');
});

const panel = (page: Page) => page.getByRole('region', { name: 'Your submission' });
const answer = (page: Page) => panel(page).getByRole('textbox', { name: 'Your answer' });
const statement = (page: Page) => panel(page).getByRole('checkbox', { name: /my own work/ });

test('a new assignment shows an empty answer box and "Not submitted"', async ({ page }) => {
  await expect(panel(page)).toContainText('Not submitted');
  await expect(answer(page)).toHaveValue('');
  await expect(panel(page).getByRole('button', { name: 'Submit for grading' })).toBeVisible();
  await expect(panel(page).getByRole('button', { name: 'Save draft' })).toBeVisible();
});

test('an empty answer is caught before anything is sent', async ({ page }) => {
  await panel(page).getByRole('button', { name: 'Save draft' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Write your answer before saving.');
});

test('a draft is saved, kept after a reload, and not yet submitted', async ({ page }) => {
  await answer(page).fill('First point: headings skip from h1 to h4.\n\nSecond point: low contrast <links>.');
  await panel(page).getByRole('button', { name: 'Save draft' }).click();
  await expect(panel(page).getByRole('status')).toContainText('Draft saved');
  await expect(panel(page)).toContainText('Draft (not submitted)');

  await page.reload();
  // Paragraphs survive the round trip to Moodle's HTML, and "<links>" stays text, not a tag.
  await expect(answer(page)).toHaveValue('First point: headings skip from h1 to h4.\n\nSecond point: low contrast <links>.');
  await expect(panel(page)).toContainText('Last changed');
});

test('submitting needs the statement ticked', async ({ page }) => {
  await answer(page).fill('My audit.');
  await panel(page).getByRole('button', { name: 'Submit for grading' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Tick the statement to confirm before submitting.');
  await expect(answer(page)).toHaveValue('My audit.'); // Nothing typed is lost
  await expect(panel(page)).toContainText('Not submitted');
});

test('submitting for grading shows the work read-only and takes it off Up next', async ({ page }) => {
  await answer(page).fill('My audit of example.com.');
  await statement(page).check();
  await panel(page).getByRole('button', { name: 'Submit for grading' }).click();

  await expect(panel(page).getByRole('status')).toHaveText('Submitted for grading.');
  await expect(panel(page)).toContainText('Submitted for grading');
  await expect(answer(page)).toHaveCount(0);
  await expect(panel(page)).toContainText('My audit of example.com.');
  await expect(panel(page).getByRole('button', { name: 'Edit submission' })).toHaveCount(0); // Locked once submitted

  await page.goto('/dashboard');
  await expect(page.getByRole('region', { name: 'Up next' }).getByRole('link', { name: 'Semantics quiz' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Up next' }).getByRole('link', { name: 'Assignment: Accessibility audit' })).toHaveCount(0);
});

test('file uploads are offered in Moodle, in a new tab', async ({ page }) => {
  await expect(panel(page).getByRole('link', { name: /Add files in Moodle/ })).toHaveAttribute('target', '_blank');
});

test('the draft and submitted states pass the accessibility checks', async ({ page }) => {
  const check = async () => {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).exclude('img[src=""]').analyze();
    expect(results.violations).toEqual([]);
  };
  await answer(page).fill('Draft text.');
  await panel(page).getByRole('button', { name: 'Save draft' }).click();
  await expect(panel(page)).toContainText('Draft (not submitted)');
  await check();

  await statement(page).check();
  await panel(page).getByRole('button', { name: 'Submit for grading' }).click();
  await expect(panel(page).getByRole('status')).toHaveText('Submitted for grading.');
  await check();
});
