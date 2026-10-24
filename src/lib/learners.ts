// The learner list for teachers and admins: shared types and the small pure rules behind it,
// kept free of server code so they can be unit tested and used in the browser.

// Roles that may see a course's learners (besides site admins, who can see every course's).
export const STAFF_ROLES = new Set(['editingteacher', 'teacher', 'manager']);

export function isStaff(roleShortnames: string[], isSiteAdmin: boolean): boolean {
  return isSiteAdmin || roleShortnames.some((r) => STAFF_ROLES.has(r));
}

// What the learners page shows for each learner.
export interface LearnerRow {
  id: number;
  name: string;
  done: number;           // Tracked activities completed
  total: number;          // Tracked activities in the course
  progress: number | null; // 0–100, or null when Moodle wouldn't say
  lastVisit: number;       // Unix seconds; 0 = never
}

// Learners who haven't visited for this long are "inactive" (the filter on the page).
export const INACTIVE_DAYS = 14;

const DAY = 86400;

export function daysSince(lastVisit: number, now: number): number | null {
  return lastVisit > 0 ? Math.max(0, Math.floor((now - lastVisit) / DAY)) : null;
}

export function isInactive(lastVisit: number, now: number): boolean {
  const days = daysSince(lastVisit, now);
  return days === null || days >= INACTIVE_DAYS;
}

// "Today", "Yesterday", "5 days ago", "3 weeks ago", "Never".
export function lastVisitLabel(lastVisit: number, now: number): string {
  const days = daysSince(lastVisit, now);
  if (days === null) return 'Never';
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

// Completed means complete (1) or complete and passed (2), as in Moodle's own progress.
export const isComplete = (state: number) => state === 1 || state === 2;
