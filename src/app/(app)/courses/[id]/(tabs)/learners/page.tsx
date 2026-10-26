import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { canSeeLearners, courseLearners, requestTime } from '@/lib/staff.server';
import { Loading } from '@/components/Loading';
import { LearnersScreen } from '@/components/screens/courses/Learners';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Students' };

export default function LearnersPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the students…" />}>
      <LearnersContent params={params} />
    </Suspense>
  );
}

async function LearnersContent({ params }: Props) {
  const courseid = Number((await params).id);
  if (!Number.isInteger(courseid)) {
    notFound();
  }
  const session = await verifySession();
  // Teachers and admins only. Anyone else gets "not found", as if the page didn't exist.
  if (!(await canSeeLearners(session.token, session.userid, courseid))) {
    notFound();
  }

  const [course, contents] = await Promise.all([
    moodle.course(session.token, courseid),
    moodle.courseContents(session.token, courseid).catch((e: unknown) => {
      if (e instanceof MoodleError) return null;
      throw e;
    }),
  ]);
  if (!course) {
    notFound();
  }
  const tracked = (contents ?? []).flatMap((s) => s.modules).filter((m) => m.completiondata?.hascompletion).map((m) => m.id);
  const learners = await courseLearners(session.token, courseid, tracked, session.userid);

  return <LearnersScreen course={course} learners={learners} now={await requestTime()} />;
}
