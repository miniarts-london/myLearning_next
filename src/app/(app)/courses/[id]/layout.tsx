import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, MoodleError } from '@/lib/moodle';
import { activityHref } from '@/lib/links';
import { Loading } from '@/components/Loading';
import { CourseShell } from '@/components/screens/courses/course-index/CourseShell';
import { CourseIndex } from '@/components/screens/courses/course-index/CourseIndex';
import type { IndexActivity, IndexSection } from '@/components/screens/courses/course-index/types';

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

// Shared by the course page and every activity page in it, so the course index stays
// in place while the learner moves between activities. The index loads in its own
// <Suspense>, so the page itself never waits for it.
export default function CourseLayout({ children, params }: Props) {
  return (
    <CourseShell index={<Suspense fallback={<Loading label="Loading…" />}><IndexData params={params} /></Suspense>}>
      {children}
    </CourseShell>
  );
}

async function IndexData({ params }: { params: Promise<{ id: string }> }) {
  const courseid = Number((await params).id);
  if (!Number.isInteger(courseid)) {
    return null;
  }
  const session = await verifySession();
  // Same calls as the page: moodle.ts caches them per request, so Moodle is asked once.
  const [course, contents] = await Promise.all([
    moodle.course(session.token, courseid),
    moodle.courseContents(session.token, courseid).catch((e: unknown) => {
      if (e instanceof MoodleError) {
        return null; // Not enrolled
      }
      throw e;
    }),
  ]);
  if (!course || !contents) {
    return null;
  }

  // Send the browser only what the index shows. Labels aren't listed, as in Moodle.
  const sections: IndexSection[] = contents
    .map((s) => ({
      id: s.id,
      name: s.name,
      activities: s.modules
        .filter((m) => m.modname !== 'label')
        .map((m): IndexActivity => ({
          id: m.id,
          name: m.name,
          href: m.url ? activityHref(courseid, m.id) : undefined,
          completion: !m.completiondata?.hascompletion ? null : m.completiondata.state > 0 ? 'done' : 'todo',
        })),
    }))
    .filter((s) => s.activities.length > 0);

  return <CourseIndex courseid={courseid} coursename={course.fullname} sections={sections} />;
}
