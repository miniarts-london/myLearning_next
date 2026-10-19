import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { CourseCard } from '@/components/CourseCard';
import { Loading } from '@/components/Loading';

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

  return (
    <>
      <h1>Welcome back, {session.firstname}</h1>
      <section aria-labelledby="my-courses">
        <h2 id="my-courses" className="section-title">My courses</h2>
        {courses.length === 0 ? (
          <p className="empty">
            You aren&apos;t enrolled in any courses yet. <Link href="/catalogue">Browse the course catalogue</Link>.
          </p>
        ) : (
          <ul className="grid" role="list">
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard id={course.id} name={course.fullname} image={course.courseimage} progress={course.progress} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
