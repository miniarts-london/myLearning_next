import type { Metadata } from 'next';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { loadUpNext } from '@/lib/upNext.server';
import { teachesCourse } from '@/lib/staff.server';
import { loadUpcomingEvents } from '@/lib/events.server';
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
  const courses = await moodle.myCourses(session.token, session.userid);
  const visible = new Set(courses.map((c) => c.id));
  // Which of these courses this user teaches (or manages).
  const teaching = await Promise.all(courses.map((c) => teachesCourse(session.token, session.userid, c.id)));
  const teachesAny = teaching.some(Boolean);
  const learnsAny = courses.length === 0 || teaching.some((t) => !t);

  // Learners get "Up next" (their deadlines); teachers get "Upcoming events" from their calendar.
  // Someone who teaches one course and studies another gets both.
  const [upNext, events] = await Promise.all([
    learnsAny ? loadUpNext(session.token, Promise.resolve(visible)) : undefined,
    teachesAny ? loadUpcomingEvents(session.token, visible) : undefined,
  ]);

  // No progress ring on courses this user teaches: it's their learners' progress that matters.
  const shown = courses.map((c, i) => (teaching[i] ? { ...c, progress: null } : c));

  return <DashboardScreen firstname={session.firstname} courses={shown} upNext={upNext} events={events} />;
}
