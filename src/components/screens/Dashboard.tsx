import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CourseCard } from '@/components/CourseCard';
import { CourseGrid } from '@/components/CourseGrid';
import { SectionTitle } from '@/components/SectionTitle';
import { UpNext } from '@/components/UpNext';
import type { EnrolledCourse } from '@/lib/types';
import type { UpNextItem } from '@/lib/upNext';

interface DashboardScreenProps {
  firstname: string;
  courses: EnrolledCourse[];
  upNext: UpNextItem[] | null; // null when Moodle's calendar couldn't be reached
}

export function DashboardScreen({ firstname, courses, upNext }: DashboardScreenProps) {
  return (
    <>
      <Typography variant="h1" sx={{ mb: 3 }}>Welcome back, {firstname}</Typography>

      <section aria-labelledby="up-next">
        <SectionTitle id="up-next">Up next</SectionTitle>
        <UpNext items={upNext} />
      </section>

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
