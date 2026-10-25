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

export interface GradeState {
  ok?: boolean;
  message?: string;
}
