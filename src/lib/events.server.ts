import 'server-only';
import { moodle, MoodleError } from './moodle';
import { toEvents, type EventItem } from './events';

// Loads "Upcoming events" for the dashboard. null if Moodle's calendar can't be reached, so the
// rest of the dashboard still shows.
export async function loadUpcomingEvents(token: string, visibleCourseIds: Set<number>): Promise<EventItem[] | null> {
  try {
    return toEvents(await moodle.upcomingEvents(token), visibleCourseIds, Math.floor(Date.now() / 1000));
  } catch (e) {
    if (e instanceof MoodleError) return null;
    throw e;
  }
}
