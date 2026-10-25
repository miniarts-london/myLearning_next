import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { login, loginAsStudent, MOODLE, resetMoodle } from './helpers';

// "contact the admin" on a course you aren't enrolled in: it sends the site admin a Moodle message.

test.beforeEach(async ({ request }) => {
  await resetMoodle(request);
});

test('a learner can contact the admin about a course, with a note', async ({ page, request }) => {
  await loginAsStudent(page);
  await page.goto('/courses/3');
  await expect(page.getByText("You aren't enrolled in this course. If you're interested, contact the admin.")).toBeVisible();
  await page.getByRole('button', { name: 'contact the admin' }).click();
  const dialog = page.getByRole('dialog', { name: 'Contact the admin' });
  await expect(dialog).toContainText('Horse Care Essentials');
  await dialog.getByLabel('Your message (optional)').fill('I look after two ponies and would love to join.');
  await dialog.getByRole('button', { name: 'Send' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('status')).toHaveText(/Your request has been sent to the administrator/);

  const messages = await (await request.get(`${MOODLE}/__messages`)).json();
  expect(messages).toHaveLength(1);
  expect(messages[0]).toMatchObject({ from: 5, touserid: 2 });
  expect(messages[0].text).toContain('Sam Student has asked for access to the course "Horse Care Essentials" (id 3)');
  expect(messages[0].text).toContain('I look after two ponies');
  expect(messages[0].text).toContain(`${MOODLE}/user/index.php?id=3`);
});

test('the message box can be cancelled, and passes the accessibility checks', async ({ page, request }) => {
  await loginAsStudent(page);
  await page.goto('/courses/3');
  await page.getByRole('button', { name: 'contact the admin' }).click();
  await expect(page.getByRole('dialog', { name: 'Contact the admin' })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: 'contact the admin' })).toBeVisible();
  expect(await (await request.get(`${MOODLE}/__messages`)).json()).toEqual([]);
});

test("a site admin isn't offered it: they get Moodle's course page instead", async ({ page }) => {
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('/courses/3');
  await expect(page.getByRole('link', { name: /Open it in Moodle/ })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: 'contact the admin' })).toHaveCount(0);
});
