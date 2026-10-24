import 'server-only';
import { cache } from 'react';
import { connection } from 'next/server';
import { moodle, MoodleError } from './moodle';
import { isComplete, isStaff, type LearnerRow } from './learners';

// Whether this user may see the learners of this course: site admins (any course), and
// teachers and managers enrolled in it. Checked on the server for every request.
export const canSeeLearners = cache(async (token: string, userid: number, courseid: number): Promise<boolean> => {
  const [info, profile] = await Promise.all([
    moodle.siteInfo(token),
    moodle.courseProfile(token, userid, courseid).catch((e: unknown) => {
      if (e instanceof MoodleError) return undefined; // Not enrolled, or the call isn't allowed
      throw e;
    }),
  ]);
  return isStaff((profile?.roles ?? []).map((r) => r.shortname), info.userissiteadmin === true);
});

// Runs `task` over `items`, at most `limit` at a time, keeping the order.
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// The course's learners (people with the student role) and each one's progress.
// `trackedCmids`: the activities learners see that have completion tracking, so progress here
// matches what each learner sees on their own course page.
export async function courseLearners(token: string, courseid: number, trackedCmids: number[]): Promise<LearnerRow[]> {
  const people = await moodle.enrolledUsers(token, courseid);
  const learners = people.filter((p) => p.roles?.some((r) => r.shortname === 'student'));
  const tracked = new Set(trackedCmids);

  // One Moodle call per learner, a few at a time, so a big class doesn't flood Moodle.
  return mapLimit(learners, 6, async (person): Promise<LearnerRow> => {
    const base = { id: person.id, name: person.fullname, lastVisit: person.lastcourseaccess ?? 0, total: tracked.size };
    try {
      const statuses = await moodle.completionFor(token, courseid, person.id);
      const done = statuses.filter((s) => tracked.has(s.cmid) && isComplete(s.state)).length;
      return { ...base, done, progress: tracked.size > 0 ? (done / tracked.size) * 100 : null };
    } catch (e) {
      if (e instanceof MoodleError) return { ...base, done: 0, progress: null };
      throw e;
    }
  });
}

// "Now", in Unix seconds, at the time of this request (not when the page was built).
export async function requestTime(): Promise<number> {
  await connection();
  return Math.floor(Date.now() / 1000);
}
