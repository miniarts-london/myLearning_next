import type { CalendarActionEvent } from './types';
import { activityHref } from './links';

// Turns Moodle's calendar action events into the dashboard's "Up next" list.
// Pure functions (no Moodle calls), so they're easy to read and to test.

export const TIME_ZONE = process.env.APP_TIME_ZONE ?? 'Europe/London';
export const LOOK_BACK_DAYS = 14;   // Show overdue items from the last two weeks
export const LOOK_AHEAD_DAYS = 28;  // …and anything due in the next four

export type UpNextGroup = 'Overdue' | 'Today' | 'Tomorrow' | 'This week' | 'Later';

export interface UpNextItem {
  id: number;
  title: string;      // The activity's name
  what: string;       // e.g. "Due", "Complete by"
  course: string;
  href: string;       // The activity in this app
  dueISO: string;     // For <time dateTime>
  dueText: string;    // e.g. "Fri 23 Oct, 17:00"
  group: UpNextGroup;
}

const DAY = 24 * 60 * 60;

// The calendar day (in TIME_ZONE) as YYYY-MM-DD, so "today" means the learner's today.
function dayKey(seconds: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(seconds * 1000));
}

export function groupFor(due: number, now: number): UpNextGroup {
  if (due < now) return 'Overdue';
  const day = dayKey(due);
  if (day === dayKey(now)) return 'Today';
  if (day === dayKey(now + DAY)) return 'Tomorrow';
  if (due < now + 7 * DAY) return 'This week';
  return 'Later';
}

const WHAT: Record<string, string> = {
  due: 'Due',
  expectcompletionon: 'Complete by',
  close: 'Closes',
  gradingdue: 'Grading due',
};

// The activity's id (cmid) is in Moodle's link: .../mod/assign/view.php?id=13
export function cmidFrom(url: string): number | undefined {
  try {
    const id = Number(new URL(url).searchParams.get('id'));
    return Number.isInteger(id) && id > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

export function toUpNext(events: CalendarActionEvent[], visibleCourseIds: Set<number>, now: number): UpNextItem[] {
  return events
    // Only courses the learner can see (Moodle also returns hidden ones to teachers and admins).
    .filter((e) => visibleCourseIds.has(e.course.id))
    .toSorted((a, b) => a.timesort - b.timesort)
    .flatMap((e): UpNextItem[] => {
      const cmid = cmidFrom(e.url);
      if (cmid === undefined) return [];
      return [{
        id: e.id,
        title: e.activityname || e.name,
        what: WHAT[e.eventtype] ?? 'Due',
        course: e.course.fullname,
        href: activityHref(e.course.id, cmid),
        dueISO: new Date(e.timesort * 1000).toISOString(),
        dueText: new Intl.DateTimeFormat('en-GB', {
          timeZone: TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        }).format(new Date(e.timesort * 1000)),
        group: groupFor(e.timesort, now),
      }];
    });
}

export const GROUP_ORDER: UpNextGroup[] = ['Overdue', 'Today', 'Tomorrow', 'This week', 'Later'];
