import { Suspense } from 'react';
import Skeleton from '@mui/material/Skeleton';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { canSeeLearners } from '@/lib/staff.server';
import { CourseHeader } from '@/components/screens/courses/CourseHeader';
import common from '@/css/common.module.css';

type Props = { children: React.ReactNode; params: Promise<{ id: string }> };

// Shared by the course's Syllabus, Students and Assignments pages, and the activities opened from
// the syllabus: the breadcrumb, course name and tabs stay in place when moving between them; only
// the page below changes.
export default function CourseTabsLayout({ children, params }: Props) {
  return (
    <>
      <Suspense fallback={<HeaderPlaceholder />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function Header({ params }: { params: Promise<{ id: string }> }) {
  const courseid = Number((await params).id);
  if (!Number.isInteger(courseid)) {
    return null;
  }
  const session = await verifySession();
  // Same calls as the pages: moodle.ts caches them per request, so Moodle is asked once.
  const [course, staff] = await Promise.all([
    moodle.course(session.token, courseid),
    canSeeLearners(session.token, session.userid, courseid), // Teachers and admins get the tabs
  ]);
  return course ? <CourseHeader course={course} withTabs={staff} /> : null;
}

// The same shape while the course loads, so nothing jumps when it arrives.
function HeaderPlaceholder() {
  return (
    <div aria-hidden>
      <Skeleton width="12rem" className={common.breadcrumbs} />
      <Skeleton variant="text" width="60%" height={56} className={common.pageTitle} />
    </div>
  );
}
