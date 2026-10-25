import type { CalendarEvent } from './types';
import { activityHref } from './links';
import { cmidFrom, groupFor, TIME_ZONE, type UpNextGroup } from './upNext';

// Turns Moodle's upcoming calendar events into the teachers' "Up next" list on the dashboard. Pure functions (no Moodle calls), so they're easy to read and to test.

export interface EventItem {
  id: number;
  title: string;
  course: string | null;  // null for site-wide and personal events
  href: string | null;    // The activity in this app, for activity events
  startISO: string;
  whenText: string;       // e.g. "Fri 23 Oct, 17:00" or "Fri 23 Oct, 17:00–18:30"
  kind: string;           // e.g. "Course event", "Due"
  group: Exclude<UpNextGroup, 'Overdue'>;
}

const KIND: Record<string, string> = {
  course: 'Course event', site: 'Site event', user: 'Personal', group: 'Group event', category: 'Category event',
  due: 'Due', open: 'Opens', close: 'Closes', expectcompletionon: 'Complete by', gradingdue: 'Grading due',
};

const day = (s: number) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(s * 1000));
const time = (s: number) => new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' }).format(new Date(s * 1000));

// `visibleCourseIds`: events from hidden courses are left out (Moodle returns them to teachers too).
export function toEvents(events: CalendarEvent[], visibleCourseIds: Set<number>, now: number): EventItem[] {
  return events
    .filter((e) => !e.course || e.course.id === 1 || visibleCourseIds.has(e.course.id))
    .filter((e) => e.timestart + (e.timeduration ?? 0) >= now) // Still to come, or still going on
    .toSorted((a, b) => a.timestart - b.timestart)
    .map((e): EventItem => {
      const cmid = e.modulename && e.url ? cmidFrom(e.url) : undefined;
      const inCourse = e.course && e.course.id !== 1 ? e.course : null;
      const end = e.timestart + (e.timeduration ?? 0);
      return {
        id: e.id,
        title: e.name,
        course: inCourse?.fullname ?? null,
        href: inCourse && cmid !== undefined ? activityHref(inCourse.id, cmid) : null,
        startISO: new Date(e.timestart * 1000).toISOString(),
        whenText: `${day(e.timestart)}, ${time(e.timestart)}${end > e.timestart ? `–${time(end)}` : ''}`,
        kind: KIND[e.eventtype] ?? 'Event',
        group: e.timestart < now ? 'Today' : (groupFor(e.timestart, now) as EventItem['group']),
      };
    });
}
