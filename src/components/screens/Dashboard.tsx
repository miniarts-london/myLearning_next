import Link from 'next/link';
import { CourseCard } from '@/components/CourseCard';
import type { EnrolledCourse } from '@/lib/types';

interface DashboardScreenProps {
  firstname: string;
  courses: EnrolledCourse[];
}

export function DashboardScreen({ firstname, courses }: DashboardScreenProps) {
  return (
    <>
      <h1>Welcome back, {firstname}</h1>
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
