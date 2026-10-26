import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { canSeeLearners, courseStudents, requestTime } from '@/lib/staff.server';
import { bySubmissionsPriority, summariseAssignment, type AssignmentItem } from '@/lib/marking';
import { submissionRows } from '@/lib/marking.server';
import { Loading } from '@/components/Loading';
import { CourseSubmissionsScreen } from '@/components/screens/submissions/CourseSubmissions';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Assignments' };

// For the course's teachers (and site admins): every assignment in the course, with how many
// students have handed in and how many are waiting to be graded. Each one opens a drawer for
// reading and grading the work.
export default function CourseSubmissionsPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the assignments…" />}>
      <CourseSubmissionsContent params={params} />
    </Suspense>
  );
}

const orNull = <T,>(p: Promise<T>) => p.catch((e: unknown) => { if (e instanceof MoodleError) return null; throw e; });

async function CourseSubmissionsContent({ params }: Props) {
  const { id } = await params;
  const courseid = Number(id);
  if (!Number.isInteger(courseid)) {
    notFound();
  }
  const session = await verifySession();
  if (!(await canSeeLearners(session.token, session.userid, courseid))) {
    notFound(); // Teachers and admins only
  }

  const [course, assignments, students] = await Promise.all([
    moodle.course(session.token, courseid),
    orNull(moodle.assignments(session.token, courseid)),
    courseStudents(session.token, courseid, session.userid),
  ]);
  if (!course) {
    notFound();
  }

  // Three requests in all, however many assignments there are.
  const ids = (assignments ?? []).map((a) => a.id);
  const [submissions, grades] = await Promise.all([
    orNull(moodle.submissionsFor(session.token, ids)),
    orNull(moodle.gradesFor(session.token, ids)),
  ]);
  const now = await requestTime();
  const studentIds = students.map((s) => s.id);

  // Each assignment's submissions come with the page, so the drawer opens straight away.
  const items: AssignmentItem[] = (assignments ?? [])
    .map((a) => {
      const subs = submissions?.get(a.id) ?? [];
      const gr = grades?.get(a.id) ?? [];
      return {
        summary: summariseAssignment(a, studentIds, subs, gr, now),
        maxGrade: a.grade && a.grade > 0 ? a.grade : null,
        rows: submissionRows(students, subs, gr),
        gradingUrl: moodleUrl(`/mod/assign/view.php?id=${a.cmid}&action=grading`),
      };
    })
    .sort((x, y) => bySubmissionsPriority(x.summary, y.summary));

  return (
    <CourseSubmissionsScreen
      course={course}
      items={items}
      students={students.length}
      loadFailed={assignments === null || submissions === null}
      moodleUrl={moodleUrl(`/mod/assign/index.php?id=${courseid}`)}
    />
  );
}
