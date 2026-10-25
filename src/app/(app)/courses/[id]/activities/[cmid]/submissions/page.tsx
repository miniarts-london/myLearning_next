import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import sanitizeHtml from 'sanitize-html';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { canSeeLearners, courseStudents } from '@/lib/staff.server';
import { fileUrl } from '@/lib/files';
import { markingStatus, parseGrade, type SubmissionRow } from '@/lib/marking';
import type { MoodleSubmission } from '@/lib/types';
import { Loading } from '@/components/Loading';
import { SubmissionsScreen } from '@/components/screens/Submissions';

type Props = { params: Promise<{ id: string; cmid: string }> };

export const metadata: Metadata = { title: 'Submissions' };

// For the course's teachers (and site admins): who has handed in an assignment, their work, and
// quick grading for points-graded assignments. Anything more (rubrics, scales, files to annotate)
// links to Moodle's own grader.
export default function SubmissionsPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the submissions…" />}>
      <SubmissionsContent params={params} />
    </Suspense>
  );
}

const orNull = <T,>(p: Promise<T>) => p.catch((e: unknown) => { if (e instanceof MoodleError) return null; throw e; });

// A learner's online text, cleaned for showing (it's their own HTML from Moodle's editor).
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

async function SubmissionsContent({ params }: Props) {
  const { id, cmid: cmidParam } = await params;
  const courseid = Number(id);
  const cmid = Number(cmidParam);
  if (!Number.isInteger(courseid) || !Number.isInteger(cmid)) {
    notFound();
  }
  const session = await verifySession();
  if (!(await canSeeLearners(session.token, session.userid, courseid))) {
    notFound(); // Teachers and admins only
  }

  const [course, assignment] = await Promise.all([
    moodle.course(session.token, courseid),
    orNull(moodle.assignment(session.token, courseid, cmid)),
  ]);
  if (!course || !assignment) {
    notFound();
  }

  const [learners, submissions, grades] = await Promise.all([
    courseStudents(session.token, courseid, session.userid),
    orNull(moodle.submissions(session.token, assignment.id)),
    orNull(moodle.grades(session.token, assignment.id)),
  ]);

  const rows: SubmissionRow[] = learners.map((l) => {
    const s = submissions?.find((x) => x.userid === l.id);
    return {
      userid: l.id,
      name: l.fullname,
      status: markingStatus(s?.status),
      submittedAt: s && s.status !== 'new' ? s.timemodified : 0,
      textHtml: textOf(s),
      files: filesOf(s),
      grade: parseGrade(grades?.find((g) => g.userid === l.id)?.grade),
    };
  });

  return (
    <SubmissionsScreen
      course={course}
      cmid={cmid}
      assignmentName={assignment.name}
      maxGrade={assignment.grade && assignment.grade > 0 ? assignment.grade : null}
      rows={rows}
      loadFailed={submissions === null}
      gradingUrl={moodleUrl(`/mod/assign/view.php?id=${cmid}&action=grading`)}
    />
  );
}
