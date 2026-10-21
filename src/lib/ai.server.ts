import 'server-only';
import { moodle, MoodleError } from './moodle';
import { activityHref } from './links';
import type { Course, CourseSection } from './types';

// Talks to the "Ask this course" Python service (ai-service/). Server only: the service token,
// like the Moodle token, never reaches the browser.
//
// The Python service never talks to Moodle. This file sends it the course content, fetched with
// the learner's own Moodle token, and with each question the activities this learner may see,
// so restricted content can't end up in an answer.

export const aiConfigured = () => Boolean(process.env.AI_SERVICE_URL && process.env.AI_SERVICE_TOKEN);

export function aiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${process.env.AI_SERVICE_URL?.replace(/\/+$/, '')}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_SERVICE_TOKEN}`, ...init.headers },
    cache: 'no-store',
  });
}

interface AiDocument {
  cmid: number;
  title: string;
  section: string;
  href: string;
  html: string;
}

const REINDEX_AFTER_SECONDS = 6 * 60 * 60; // Pick up teachers' edits a few times a day

// What the index should hold: course and section summaries, labels, page content, assignment
// briefs and URL descriptions. Every activity gets at least its name, so "where's the quiz?" works.
async function collectDocuments(token: string, course: Course, sections: CourseSection[]): Promise<AiDocument[]> {
  const orEmpty = <T,>(p: Promise<T[]>) => p.catch((e: unknown) => (e instanceof MoodleError ? [] : Promise.reject(e)));
  const [pages, urls, assignments] = await Promise.all([
    orEmpty(moodle.pages(token, course.id)),
    orEmpty(moodle.urls(token, course.id)),
    orEmpty(moodle.assignments(token, course.id)),
  ]);
  const courseHref = `/courses/${course.id}`;
  const docs: AiDocument[] = [];

  if (course.summary?.trim()) {
    docs.push({ cmid: 0, title: course.fullname, section: 'Course overview', href: courseHref, html: course.summary });
  }
  for (const section of sections) {
    if (section.summary?.trim()) {
      docs.push({ cmid: 0, title: section.name, section: section.name, href: courseHref, html: section.summary });
    }
    for (const m of section.modules) {
      const href = m.url ? activityHref(course.id, m.id) : courseHref;
      const page = m.modname === 'page' ? pages.find((p) => p.coursemodule === m.id) : undefined;
      const url = m.modname === 'url' ? urls.find((u) => u.coursemodule === m.id) : undefined;
      const assignment = m.modname === 'assign' ? assignments.find((a) => a.cmid === m.id) : undefined;
      const body = page ? `${page.intro}${page.content}`
        : url ? `${url.intro}<p>Link: ${url.externalurl}</p>`
        : assignment ? assignment.intro
        : m.description ?? '';
      docs.push({ cmid: m.id, title: m.name, section: section.name, href, html: `<p>${m.modname}: ${m.name}</p>${body}` });
    }
  }
  return docs;
}

// Makes sure the course is indexed with everything this learner can see, and fresh enough.
export async function ensureIndexed(token: string, course: Course, sections: CourseSection[]): Promise<void> {
  const status = await (await aiFetch(`/courses/${course.id}/index`)).json() as { indexed: boolean; cmids: number[]; indexed_at: number | null };
  const visible = sections.flatMap((s) => s.modules.map((m) => m.id));
  const missing = visible.some((id) => !status.cmids.includes(id));
  const stale = !status.indexed_at || Date.now() / 1000 - status.indexed_at > REINDEX_AFTER_SECONDS;
  if (status.indexed && !missing && !stale) {
    return;
  }
  const documents = await collectDocuments(token, course, sections);
  const response = await aiFetch(`/courses/${course.id}/documents`, { method: 'PUT', body: JSON.stringify({ documents }) });
  if (!response.ok) {
    throw new Error(`Indexing failed: ${response.status}`);
  }
}
