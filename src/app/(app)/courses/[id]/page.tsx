import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { canSeeLearners, teachesCourse } from '@/lib/staff.server';
import { Loading } from '@/components/Loading';
import { CourseScreen } from '@/components/screens/courses/Course';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Course' };

export default function CoursePage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the course…" />}>
      <CourseContent params={params} />
    </Suspense>
  );
}

async function CourseContent({ params }: Props) {
  const { id } = await params;
  const courseid = Number(id);
  if (!Number.isInteger(courseid)) {
    notFound();
  }
  const session = await verifySession();

  const [course, contents, staff, teaches] = await Promise.all([
    moodle.course(session.token, courseid),
    // Moodle refuses the contents of a course the user can't access: show a friendly message instead.
    moodle.courseContents(session.token, courseid).catch((e: unknown) => {
      if (e instanceof MoodleError) {
        return null;
      }
      throw e;
    }),
    canSeeLearners(session.token, session.userid, courseid), // Teachers and admins get a "Learners" link
    teachesCourse(session.token, session.userid, courseid),  // Teachers get no progress ring of their own
  ]);
  if (!course) {
    notFound();
  }

  // moodle.courseContents() has already removed hidden sections and activities; drop empty sections too.
  const sections = contents?.filter((s) => s.modules.length > 0 || s.summary) ?? null;

  const tracked = (sections ?? []).flatMap((s) => s.modules).filter((m) => m.completiondata?.hascompletion);
  const done = tracked.filter((m) => (m.completiondata?.state ?? 0) > 0).length;

  return (
    <CourseScreen
      course={course}
      sections={sections}
      progress={!teaches && tracked.length > 0 ? (done / tracked.length) * 100 : null}
      moodleCourseUrl={moodleUrl(`/course/view.php?id=${courseid}`)}
      learnersHref={staff ? `/courses/${courseid}/learners` : undefined}
      canRequestAccess={!staff}
      forLearner={!teaches}
    />
  );
}
