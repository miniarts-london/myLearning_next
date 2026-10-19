import type { Metadata } from 'next';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { Loading } from '@/components/Loading';
import { HomeScreen } from '@/components/screens/home/Home';

export const metadata: Metadata = { title: 'Home' };

export default function HomePage() {
  return (
    <Suspense fallback={<Loading label="Loading your courses…" />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const session = await verifySession();
  const courses = await moodle.myCourses(session.token, session.userid);
  return <HomeScreen firstname={session.firstname} courses={courses} />;
}
