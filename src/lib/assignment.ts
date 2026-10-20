import type { AssignSubmissionPlugin, AssignSubmissionStatus, MoodleAssignment } from './types';

// Turns Moodle's assignment and submission data into what the assignment screen needs.
// Pure functions: no Moodle calls, no React.

export type SubmissionStatus = 'new' | 'draft' | 'submitted' | 'reopened';

export interface AssignmentView {
  assignid: number;
  status: SubmissionStatus;
  lastModified: number | null;       // Unix seconds
  onlineTextEnabled: boolean;
  html: string;                      // The online text as Moodle stores it (HTML)
  plain: string;                     // The same, as plain text for editing
  filesEnabled: boolean;
  files: { name: string; url: string }[];
  usesDrafts: boolean;               // Save draft, then Submit for grading
  statement: string | null;          // Must be agreed to when submitting, or null
  canEdit: boolean;
  canSubmit: boolean;
  open: boolean;                     // Submissions are being accepted
  grade: string | null;
  feedbackHtml: string | null;
}

// Moodle's default wording, for versions that don't send the statement's text.
const DEFAULT_STATEMENT = 'This submission is my own work, except where I have acknowledged the use of the works of other people.';

const enabled = (a: MoodleAssignment, plugin: string) =>
  a.configs.some((c) => c.subtype === 'assignsubmission' && c.plugin === plugin && c.name === 'enabled' && c.value === '1');

const editorText = (plugins: AssignSubmissionPlugin[] | undefined, type: string) =>
  plugins?.find((p) => p.type === type)?.editorfields?.[0]?.text ?? '';

// Moodle HTML → text for the textarea: paragraphs become blank lines, <br> becomes a new line.
export function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}

// Text from the textarea → safe HTML for Moodle: everything escaped, blank lines become paragraphs.
export function plainToHtml(text: string): string {
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${escape(para).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function toAssignmentView(a: MoodleAssignment, s: AssignSubmissionStatus): AssignmentView {
  const attempt = s.lastattempt;
  const submission = attempt?.submission;
  const html = editorText(submission?.plugins, 'onlinetext');
  const files = submission?.plugins?.find((p) => p.type === 'file')?.fileareas
    ?.flatMap((area) => area.files ?? [])
    .map((f) => ({ name: f.filename, url: f.fileurl })) ?? [];
  const graded = Boolean(attempt?.graded && s.feedback?.gradefordisplay);

  return {
    assignid: a.id,
    status: submission?.status ?? 'new',
    lastModified: submission?.timemodified || null,
    onlineTextEnabled: enabled(a, 'onlinetext'),
    html,
    plain: htmlToPlain(html),
    filesEnabled: enabled(a, 'file'),
    files,
    usesDrafts: a.submissiondrafts === 1,
    statement: a.requiresubmissionstatement === 1 ? (a.submissionstatement?.trim() ? htmlToPlain(a.submissionstatement) : DEFAULT_STATEMENT) : null,
    canEdit: Boolean(attempt?.canedit),
    canSubmit: Boolean(attempt?.cansubmit),
    open: Boolean(attempt?.submissionsenabled) && !attempt?.locked,
    grade: graded ? htmlToPlain(s.feedback?.gradefordisplay ?? '') : null,
    feedbackHtml: editorText(s.feedback?.plugins, 'comments') || null,
  };
}

export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  new: 'Not submitted',
  reopened: 'Reopened: not submitted',
  draft: 'Draft (not submitted)',
  submitted: 'Submitted for grading',
};
