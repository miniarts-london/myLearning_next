import { expect, test } from '@playwright/test';
import { courseIndex, courseSection, expectNotFound, loginAsStudent, resetMoodle } from './helpers';

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

test('the dashboard lists enrolled courses with progress, and never hidden ones', async ({ page }) => {
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Accessible Web Design' })).toBeVisible();
  await expect(main.getByRole('progressbar', { name: 'Accessible Web Design progress' })).toHaveAttribute('aria-valuenow', '25');
  await expect(main).not.toContainText('Secret course');
});

test('the catalogue groups courses by category, leaving out hidden ones', async ({ page }) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Courses' }).click();
  await expect(page).toHaveURL(/\/catalogue$/);
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 2, name: 'Web Development' })).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Personal Development' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Horse Care Essentials' })).toBeVisible();
  await expect(main).not.toContainText('Secret course');
  await expect(main).not.toContainText('Hidden category');
});

test('a hidden course is "not found" even by its address', async ({ page }) => {
  await page.goto('/courses/4');
  await expectNotFound(page);
});

test('a course you are not enrolled in offers to contact the admin', async ({ page }) => {
  await page.goto('/courses/3');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Horse Care Essentials');
  await expect(page.getByText(/You aren't enrolled in this course\. If you're interested, contact the admin\./)).toBeVisible();
  await expect(page.getByRole('button', { name: 'contact the admin' })).toBeVisible();
});

test('the course page lists sections and visible activities only', async ({ page }) => {
  await page.getByRole('link', { name: 'Accessible Web Design' }).click();
  await expect(page).toHaveURL(/\/courses\/2$/);
  const main = page.getByRole('main');
  await expect(courseSection(page, 'Why accessibility matters')).toBeVisible();
  await expect(main.getByRole('heading', { level: 2, name: 'Semantic HTML' })).toBeVisible();
  await expect(main.getByText('Use the right element for the job.')).toBeVisible(); // The label's text
  await expect(main).not.toContainText('Hidden draft page');
  await expect(main).not.toContainText('Hidden section');
});

test('Mark as done updates the button, the progress bar, the course index and the dashboard', async ({ page }) => {
  await page.goto('/courses/2');
  const progress = page.getByRole('progressbar', { name: 'Course progress' });
  const section = courseSection(page, 'Why accessibility matters');
  await expect(progress).toHaveAttribute('aria-valuenow', '25');

  await section.getByRole('button', { name: 'Mark as done for Assignment: Accessibility audit' }).click();
  await expect(section.getByRole('button', { name: 'Done – Assignment: Accessibility audit. Select to mark as not done' })).toBeVisible();
  await expect(progress).toHaveAttribute('aria-valuenow', '50');
  await expect(courseIndex(page).getByRole('link', { name: /Assignment: Accessibility audit/ })).toContainText('Done');

  await page.goto('/dashboard');
  await expect(page.getByRole('progressbar', { name: 'Accessible Web Design progress' })).toHaveAttribute('aria-valuenow', '50');

  // And back again.
  await page.goto('/courses/2');
  await section.getByRole('button', { name: 'Done – Assignment: Accessibility audit. Select to mark as not done' }).click();
  await expect(progress).toHaveAttribute('aria-valuenow', '25');
});

test('activities Moodle completes automatically show a status, not a button', async ({ page }) => {
  await page.goto('/courses/2');
  const quiz = courseSection(page, 'Semantic HTML').getByRole('listitem').filter({ hasText: 'Semantics quiz' });
  await expect(quiz).toContainText('To do');
  await expect(quiz.getByRole('button')).toHaveCount(0);
});
