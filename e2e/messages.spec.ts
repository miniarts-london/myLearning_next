import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { login, loginAsStudent, MOODLE, resetMoodle } from './helpers';

// Messages: the header button, the list of conversations, reading and replying.
// The mock has one conversation: Tess Teacher and Sam Student, with one message Sam hasn't read.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

const panel = (page: Page) => page.getByRole('dialog', { name: /Messages|Tess Teacher/ });

test('the header shows how many conversations are unread', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Messages, 1 unread' })).toBeVisible();
});

test('a conversation can be opened, read and replied to', async ({ page }) => {
  await page.getByRole('button', { name: /^Messages/ }).click();
  const tess = panel(page).getByRole('button', { name: /^Tess Teacher, 1 unread/ });
  await expect(tess).toContainText('Shout if you need help with contrast checks.'); // HTML shown as plain text
  await tess.click();

  const log = page.getByRole('log', { name: 'Messages with Tess Teacher' });
  await expect(log).toContainText('Hi Sam, how are you getting on with the audit?');
  await expect(log).toContainText('Nearly done, thanks!');

  const box = page.getByLabel('Write a message');
  await expect(box).toBeFocused();
  await box.fill('Thanks, I will!');
  await box.press('Enter');
  await expect(log).toContainText('Thanks, I will!');
  await expect(box).toHaveValue('');

  // It really went to Moodle.
  await page.getByRole('button', { name: 'Back to all conversations' }).click();
  await expect(panel(page).getByRole('button', { name: /^Tess Teacher/ })).toContainText('You: Thanks, I will!');
});

test('replies appear in an open conversation without reloading', async ({ page, request }) => {
  await page.getByRole('button', { name: /^Messages/ }).click();
  await panel(page).getByRole('button', { name: /^Tess Teacher/ }).click();
  await request.post(`${MOODLE}/__reply?text=${encodeURIComponent('Any questions before Friday?')}`);
  await expect(page.getByRole('log', { name: 'Messages with Tess Teacher' })).toContainText('Any questions before Friday?', { timeout: 15_000 });
});

test('a teacher sees a message sent from the learner list in Messages', async ({ page, browser }) => {
  const teacher = await browser.newPage();
  await login(teacher, 'teacher');
  await expect(teacher).toHaveURL(/\/dashboard$/);
  await teacher.goto('/courses/2/learners');
  await teacher.getByRole('button', { name: 'Priya Shah, send a message' }).click();
  await teacher.getByLabel(/Your message/).fill('Well done, Priya!');
  await teacher.getByRole('button', { name: 'Send' }).click();
  await expect(teacher.getByRole('status').filter({ hasText: 'Message sent to Priya Shah.' })).toBeVisible();

  await teacher.getByRole('button', { name: /^Messages/ }).click();
  await expect(panel(teacher).getByRole('button', { name: /^Priya Shah/ })).toContainText('You: Well done, Priya!');
  await teacher.close();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('the messages panel passes the accessibility checks', async ({ page }) => {
  await page.getByRole('button', { name: /^Messages/ }).click();
  await expect(panel(page).getByRole('button', { name: /^Tess Teacher/ })).toBeVisible();
  let results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);

  await panel(page).getByRole('button', { name: /^Tess Teacher/ }).click();
  await expect(page.getByRole('log')).toBeVisible();
  results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});
