import 'server-only';
import sanitizeHtml from 'sanitize-html';
import { fileUrl } from '@/lib/files';
import { markingStatus, parseGrade, type SubmissionRow } from '@/lib/marking';
import type { MoodleGrade, MoodleSubmission } from '@/lib/types';

// A student's online text, cleaned for showing (it's their own HTML from Moodle's editor).
function textOf(s: MoodleSubmission | undefined): string {
  const html = s?.plugins?.find((p) => p.type === 'onlinetext')?.editorfields?.[0]?.text ?? '';
  return html.trim() ? sanitizeHtml(html) : '';
}
function filesOf(s: MoodleSubmission | undefined): { name: string; href: string }[] {
  return (s?.plugins?.find((p) => p.type === 'file')?.fileareas ?? [])
    .flatMap((area) => area.files ?? [])
    .map((f) => ({ name: f.filename, href: fileUrl(f.fileurl) ?? '' }))
    .filter((f) => f.href);
}

// One row per student for an assignment's submissions list.
export function submissionRows(
  students: { id: number; fullname: string }[],
  submissions: MoodleSubmission[],
  grades: MoodleGrade[],
): SubmissionRow[] {
  return students.map((l) => {
    const s = submissions.find((x) => x.userid === l.id);
    return {
      userid: l.id,
      name: l.fullname,
      status: markingStatus(s?.status),
      submittedAt: s && s.status !== 'new' ? s.timemodified : 0,
      textHtml: textOf(s),
      files: filesOf(s),
      grade: parseGrade(grades.find((g) => g.userid === l.id)?.grade),
    };
  });
}
