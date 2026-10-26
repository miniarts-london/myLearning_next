// Marking an assignment: shared types and the small rules behind the teachers' Submissions page.
// No server code here, so they can be unit tested and used in the browser.

export type MarkingStatus = 'submitted' | 'draft' | 'notsubmitted';

export interface SubmissionRow {
  userid: number;
  name: string;
  status: MarkingStatus;
  submittedAt: number;        // Unix seconds, 0 when nothing has been saved
  textHtml: string;           // Their online text, already cleaned on the server ('' when none)
  files: { name: string; href: string }[];
  grade: number | null;       // Points, or null when not graded yet
}

export const MARKING_STATUS_LABEL: Record<MarkingStatus, string> = {
  submitted: 'Submitted',
  draft: 'Draft',
  notsubmitted: 'Not submitted',
};

export function markingStatus(moodleStatus: string | undefined): MarkingStatus {
  if (moodleStatus === 'submitted') return 'submitted';
  if (moodleStatus === 'draft') return 'draft';
  return 'notsubmitted';
}

// Moodle sends grades as text: "7.00000", or "-1.00000" / "" when not graded.
export function parseGrade(text: string | undefined): number | null {
  const n = Number(text);
  return text !== undefined && text !== '' && Number.isFinite(n) && n >= 0 ? n : null;
}

export function formatGrade(grade: number): string {
  return Number.isInteger(grade) ? String(grade) : grade.toFixed(2).replace(/0+$/, '');
}

// A grade typed in by the teacher: a number from 0 to the maximum, up to two decimal places.
export function checkGrade(input: string, max: number): { grade: number } | { error: string } {
  const text = input.trim();
  if (!text) return { error: 'Enter a grade.' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: 'The grade must be a number.' };
  if (n < 0 || n > max) return { error: `The grade must be between 0 and ${formatGrade(max)}.` };
  if (Math.round(n * 100) !== n * 100) return { error: 'Use at most two decimal places.' };
  return { grade: n };
}

// Submitted work that has no grade yet: what a teacher usually wants to see first.
export const needsGrading = (r: SubmissionRow) => r.status === 'submitted' && r.grade === null;

export const FEEDBACK_MAX = 4000;

// One assignment's line on the course-wide Submissions page.
export interface AssignmentSummary {
  cmid: number;
  name: string;
  duedate: number;     // Unix seconds, 0 when there's no due date
  students: number;
  submitted: number;
  toGrade: number;     // Submitted, no grade yet
  graded: number;
  missing: number;     // Not submitted (drafts included)
  overdue: boolean;    // Past the due date with work still missing
}

export function summariseAssignment(
  a: { cmid: number; name: string; duedate: number },
  studentIds: number[],
  submissions: { userid: number; status: string }[],
  grades: { userid: number; grade: string }[],
  now: number, // Unix seconds
): AssignmentSummary {
  const ids = new Set(studentIds);
  const submittedBy = new Set(submissions.filter((s) => ids.has(s.userid) && markingStatus(s.status) === 'submitted').map((s) => s.userid));
  const gradedIds = new Set(grades.filter((g) => ids.has(g.userid) && parseGrade(g.grade) !== null).map((g) => g.userid));
  const missing = ids.size - submittedBy.size;
  return {
    cmid: a.cmid,
    name: a.name,
    duedate: a.duedate,
    students: ids.size,
    submitted: submittedBy.size,
    toGrade: [...submittedBy].filter((id) => !gradedIds.has(id)).length,
    graded: gradedIds.size,
    missing,
    overdue: a.duedate > 0 && a.duedate < now && missing > 0,
  };
}

// An assignment on the Assignments tab: its line in the table, and its submissions for the drawer.
export interface AssignmentItem {
  summary: AssignmentSummary;
  maxGrade: number | null; // Points, or null when it's graded another way (scale, rubric…): in Moodle
  rows: SubmissionRow[];
  gradingUrl: string;      // Moodle's grader for it
}

// Most work waiting to be graded first; then by due date (soonest first, no due date last).
export function bySubmissionsPriority(a: AssignmentSummary, b: AssignmentSummary): number {
  return b.toGrade - a.toGrade || (a.duedate || Infinity) - (b.duedate || Infinity) || a.name.localeCompare(b.name);
}

export interface GradeState {
  ok?: boolean;
  message?: string;
}
