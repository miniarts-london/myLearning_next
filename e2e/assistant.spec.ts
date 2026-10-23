import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AI, CLAUDE, loginAsStudent, resetMoodle } from './helpers';

// The real agent loop and the real Anthropic SDK, against a scripted mock of the Claude API
// (e2e/mock-anthropic.mjs). The tools run for real against the mock Moodle and mock AI service.

test.beforeEach(async ({ page, request }) => {
  await resetMoodle(request);
  await loginAsStudent(page);
});

const panel = (page: Page) => page.getByRole('dialog', { name: 'Assistant' });

async function say(page: Page, message: string) {
  if (!(await panel(page).isVisible())) await page.getByRole('button', { name: 'Assistant' }).click();
  await panel(page).getByRole('textbox', { name: 'Message' }).fill(message);
  await panel(page).getByRole('button', { name: 'Send' }).click();
}

const reply = (page: Page, n: number) => panel(page).getByRole('region', { name: `Message ${n}` });

test('the assistant is on every page, but not the login page', async ({ page }) => {
  for (const path of ['/dashboard', '/catalogue', '/courses/2', '/courses/2/activities/11']) {
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Assistant' })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('button', { name: 'Assistant' })).toHaveCount(0);
});

test('it uses a tool, shows the step, and answers with links into the app', async ({ page }) => {
  await say(page, 'What should I focus on this week?');
  const answer = reply(page, 1);
  await expect(answer.getByText('Checking your deadlines')).toBeVisible();
  await expect(answer.getByRole('link', { name: 'Use the right element' })).toHaveAttribute('href', '/courses/2/activities/21');
  await expect(answer.getByRole('listitem')).toHaveCount(4); // The four deadlines in the mock Moodle
  await expect(answer).toContainText('(overdue)');
  await expect(answer.locator('strong')).toHaveText('overdue');
  await expect(panel(page)).toContainText('29 messages left today');

  await answer.getByRole('link', { name: 'Semantics quiz' }).click();
  await expect(page).toHaveURL(/\/courses\/2\/activities\/22$/);
  await expect(panel(page)).toBeHidden();
});

test('it chains tools over several rounds', async ({ page, request }) => {
  await say(page, 'How am I doing?');
  const answer = reply(page, 1);
  await expect(answer.getByText('Looking up your courses')).toBeVisible();
  await expect(answer.getByText('Looking at the course')).toBeVisible();
  await expect(answer).toContainText("you've done 1 of 4 done");
  await expect(answer.getByRole('link', { name: 'Accessible Web Design' })).toHaveAttribute('href', '/courses/2');
  await expect(answer.getByRole('link', { name: 'Assignment: Accessibility audit' })).toBeVisible();
  const { requests } = await (await request.get(`${CLAUDE}/__last`)).json();
  expect(requests).toBe(3); // Two rounds of tools, then the answer
});

test('on a course page it knows "this course" and searches only what the learner can see', async ({ page, request }) => {
  await page.goto('/courses/2/activities/11');
  await say(page, 'What does this course say about WCAG principles?');
  const answer = reply(page, 1);
  await expect(answer.getByText(/Searching the course for/)).toBeVisible();
  await expect(answer).toContainText('WCAG has four principles');
  await expect(answer.getByRole('link', { name: 'Accessibility and WCAG' })).toHaveAttribute('href', '/courses/2/activities/11');

  const { last } = await (await request.get(`${CLAUDE}/__last`)).json();
  expect(last.system).toContain('Sam');
  expect(last.system).toContain('course with id 2');
  const ai = await (await request.get(`${AI}/__last`)).json();
  expect(ai.search.allowed_cmids).not.toContain(23); // Hidden activity
  expect(ai.search.allowed_cmids).not.toContain(31); // Activity in a hidden section
});

test("when the course doesn't cover something, it says so", async ({ page }) => {
  await page.goto('/courses/2');
  await say(page, 'What does this course say about grooming horses?');
  await expect(reply(page, 1)).toContainText("This course doesn't seem to cover that");
});

test('it only has read-only tools', async ({ page, request }) => {
  await say(page, 'Hello');
  await expect(reply(page, 1)).toContainText('I can help with your courses');
  const { last } = await (await request.get(`${CLAUDE}/__last`)).json();
  expect(last.tools.map((t: { name: string }) => t.name).sort()).toEqual(
    ['get_activity', 'get_course_overview', 'get_upcoming_deadlines', 'list_my_courses', 'search_course_content']);
});

test('follow-up questions include the conversation so far', async ({ page, request }) => {
  await say(page, 'Hello');
  await expect(reply(page, 1)).toContainText('I can help');
  await say(page, 'What is due?');
  await expect(reply(page, 2).getByRole('link', { name: 'Semantics quiz' })).toBeVisible();
  const { last } = await (await request.get(`${CLAUDE}/__last`)).json();
  expect(last.messages[0]).toEqual({ role: 'user', content: 'Hello' });
  expect(last.messages[1].role).toBe('assistant');
});

test('it stops after the step limit and answers with what it has', async ({ page, request }) => {
  await say(page, 'loop forever please');
  await expect(reply(page, 1)).toContainText('I looked as far as I could');
  const { requests } = await (await request.get(`${CLAUDE}/__last`)).json();
  expect(requests).toBe(7); // 6 rounds of tools, then a final answer with tools switched off
});

test('links to other sites are shown as plain text', async ({ page }) => {
  await say(page, 'show me an evil link');
  const answer = reply(page, 1);
  await expect(answer).toContainText('Read this and the course.');
  await expect(answer.getByRole('link', { name: 'this' })).toHaveCount(0);
  await expect(answer.getByRole('link', { name: 'the course' })).toHaveAttribute('href', '/courses/2');
});

test('the API refuses other sites and logged-out requests', async ({ page, request }) => {
  const fromElsewhere = await page.request.post('/api/assistant', {
    data: { messages: [{ role: 'user', content: 'hi' }] }, headers: { origin: 'https://evil.example' },
  });
  expect(fromElsewhere.status()).toBe(403);
  const loggedOut = await request.post('/api/assistant', { data: { messages: [{ role: 'user', content: 'hi' }] } });
  expect(loggedOut.status()).toBe(401);
});

test('the panel passes the accessibility checks', async ({ page }) => {
  await say(page, 'What is due this week?');
  await expect(reply(page, 1).getByRole('link', { name: 'Semantics quiz' })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});
