import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CourseTabs } from '@/components/screens/courses/CourseTabs';
import type { Course } from '@/lib/types';
import common from '@/css/common.module.css';
import styles from '@/css/CourseTabs.module.css';

// The top of a course's Syllabus, Students and Assignments pages and its activities, rendered once
// by their shared layout: breadcrumb and course name, then, for the course's teachers and site admins, the tabs.
export function CourseHeader({ course, withTabs }: { course: Course; withTabs: boolean }) {
  return (
    <>
      <Breadcrumbs className={common.breadcrumbs}>
        <Link href="/dashboard">Dashboard</Link>
        <Typography className={common.breadcrumbCurrent}>{course.categoryname}</Typography>
      </Breadcrumbs>
      <Typography variant="h1" className={withTabs ? styles.title : common.pageTitle}>{course.fullname}</Typography>
      {withTabs && <CourseTabs courseid={course.id} />}
    </>
  );
}
