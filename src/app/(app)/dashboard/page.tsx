import type { Metadata } from 'next';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
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
  const session = await verifySession();
  const courses = await moodle.myCourses(session.token, session.userid);
  return <DashboardScreen firstname={session.firstname} courses={courses} />;
}
