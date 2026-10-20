import 'server-only';
import { moodle, MoodleError } from './moodle';
import { LOOK_AHEAD_DAYS, LOOK_BACK_DAYS, toUpNext, type UpNextItem } from './upNext';

const DAY = 24 * 60 * 60;

// Loads "Up next" for the dashboard. Returns null if Moodle's calendar can't be reached,
// so the rest of the dashboard still shows. Call it after connection(), so "now" is the
// time of the request rather than a cached build time.
// `visibleCourseIds` can still be loading: the calendar request starts straight away either way.
export async function loadUpNext(token: string, visibleCourseIds: Promise<Set<number>>): Promise<UpNextItem[] | null> {
  const now = Math.floor(Date.now() / 1000);
  try {
    const [events, visible] = await Promise.all([
      moodle.actionEvents(token, now - LOOK_BACK_DAYS * DAY, now + LOOK_AHEAD_DAYS * DAY),
      visibleCourseIds,
    ]);
    return toUpNext(events, visible, now);
  } catch (e) {
    if (e instanceof MoodleError) {
      return null;
    }
    throw e;
  }
}
