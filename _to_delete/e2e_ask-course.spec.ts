import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AI, loginAsStudent, resetMoodle } from './helpers';

// The Python service is replaced by e2e/mock-ai.mjs here; ai-service/tests cover the real one.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
  await page.goto('/courses/2');
});

const panel = (page: Page) => page.getByRole('dialog', { name: 'Ask this course' });

async function ask(page: Page, question: string) {
  await page.getByRole('button', { name: 'Ask this course' }).click();
  await panel(page).getByRole('textbox', { name: 'Your question' }).fill(question);
  await panel(page).getByRole('button', { name: 'Ask', exact: true }).click();
}

test('answers from the course, with links to the activities it used', async ({ page }) => {
  await ask(page, 'What are the four principles of WCAG?');
  const answer = panel(page).getByRole('region', { name: 'Question 1' });
  await expect(answer).toContainText('What are the four principles of WCAG?');
  await expect(answer).toContainText('According to the course, ');
  await expect(answer).toContainText('[1]');
  await expect(panel(page)).toContainText('19 questions left today');

  const source = panel(page).getByRole('navigation', { name: 'Sources for question 1' }).getByRole('link', { name: /Accessibility and WCAG/ });
  await source.click();
  await expect(page).toHaveURL(/\/courses\/2\/activities\/11$/);
  await expect(panel(page)).toBeHidden();

  // The conversation is still there when the panel is opened again.
  await page.getByRole('button', { name: 'Ask this course' }).click();
  await expect(panel(page)).toContainText('What are the four principles of WCAG?');
});

test('only what the learner can see is indexed and searched', async ({ page, request }) => {
  await ask(page, 'Tell me about semantic HTML');
  await expect(panel(page).getByRole('region', { name: 'Question 1' })).toContainText(/According to the course|couldn't find/);

  const last = await (await request.get(`${AI}/__last`)).json();
  const indexed = last.documents.map((d: { cmid: number }) => d.cmid);
  expect(indexed).toEqual(expect.arrayContaining([11, 12, 13, 20, 21, 22]));
  expect(indexed).not.toContain(23); // Hidden activity
  expect(indexed).not.toContain(31); // Activity in a hidden section
  expect(last.ask.allowed_cmids).not.toContain(23);
  expect(last.ask.user_id).toBe('5');
  // Page content is indexed, not just names.
  const page11 = last.documents.find((d: { cmid: number }) => d.cmid === 11);
  expect(page11.html).toContain('WCAG has four principles');
  expect(page11.href).toBe('/courses/2/activities/11');
});

test('says so when the course does not cover the question', async ({ page }) => {
  await ask(page, 'Zebra migration patterns?');
  await expect(panel(page).getByRole('region', { name: 'Question 1' })).toContainText("couldn't find anything about that in this course");
});

test("shows the service's message when the daily limit is reached", async ({ page }) => {
  await ask(page, 'I have asked too many questions');
  await expect(panel(page).getByRole('alert')).toContainText("You've asked 20 questions today");
});

test('a course you are not enrolled in can not be asked about', async ({ page }) => {
  await page.goto('/courses/3');
  await ask(page, 'What is in this course?');
  await expect(panel(page).getByRole('alert')).toContainText('You need to be enrolled in this course');
});

test('the panel passes the accessibility checks', async ({ page }) => {
  await ask(page, 'What contrast ratio does text need?');
  await expect(panel(page).getByRole('region', { name: 'Question 1' })).toContainText(/According to the course|couldn't find/);
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('the API needs a login', async ({ request }) => {
  const response = await request.post('/api/courses/2/ask', { data: { question: 'hi' }, headers: { cookie: '' } });
  expect(response.status()).toBe(401);
});
