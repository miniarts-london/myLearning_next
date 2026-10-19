import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CourseCard } from '@/components/CourseCard';
import { CourseGrid } from '@/components/CourseGrid';
import { SectionTitle } from '@/components/SectionTitle';
import type { EnrolledCourse } from '@/lib/types';

interface DashboardScreenProps {
  firstname: string;
  courses: EnrolledCourse[];
}

export function DashboardScreen({ firstname, courses }: DashboardScreenProps) {
  return (
    <>
      <Typography variant="h1" sx={{ mb: 3 }}>Welcome back, {firstname}</Typography>
      <section aria-labelledby="my-courses">
        <SectionTitle id="my-courses">My courses</SectionTitle>
        {courses.length === 0 ? (
          <Alert severity="info">
            You aren&apos;t enrolled in any courses yet. <Link href="/catalogue">Browse the courses</Link>.
          </Alert>
        ) : (
          <CourseGrid>
            {courses.map((course) => (
              <li key={course.id}>
                <CourseCard id={course.id} name={course.fullname} image={course.courseimage} progress={course.progress} />
              </li>
            ))}
          </CourseGrid>
        )}
      </section>
    </>
  );
}
