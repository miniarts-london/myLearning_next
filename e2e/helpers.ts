import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const MOODLE = 'http://localhost:8099';

// Put the mock Moodle's completion data back to the start, so each test begins the same way.
export async function resetMoodle(request: APIRequestContext) {
  await request.post(`${MOODLE}/__reset`);
}

export async function login(page: Page, username = 'student', password = 'secret') {
  await page.goto('/login');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

export async function loginAsStudent(page: Page) {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard$/);
}

// The course index is a <nav> labelled "Course index" (the wide-screen sidebar).
export const courseIndex = (page: Page) => page.locator('#course-index').getByRole('navigation', { name: 'Course index' });

// Pages stream in (Next.js with Suspense), so when Moodle says "no", the page has already started
// with a 200 status. Check what the learner sees instead.
export async function expectNotFound(page: Page) {
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('This page could not be found.')).toBeVisible();
}

// The course page's own list of activities, one <section> (region) per course section.
export const courseSection = (page: Page, name: string) => page.getByRole('region', { name });
