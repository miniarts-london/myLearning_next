import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { loadUpNext } from '@/lib/upNext.server';
import { Loading } from '@/components/Loading';
import { DashboardScreen } from '@/components/screens/Dashboard';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading label="Loading your courses…" />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await connection(); // Deadlines depend on "now": always render at request time.
  const session = await verifySession();
  // The course list and the calendar load at the same time. Up next only shows courses in
  // the list, which has already left out hidden courses.
  const coursesRequest = moodle.myCourses(session.token, session.userid);
  const [courses, upNext] = await Promise.all([
    coursesRequest,
    loadUpNext(session.token, coursesRequest.then((list) => new Set(list.map((c) => c.id)))),
  ]);

  return <DashboardScreen firstname={session.firstname} courses={courses} upNext={upNext} />;
}
