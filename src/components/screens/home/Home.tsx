import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { CourseCard } from '@/components/CourseCard';
import { CourseGrid } from '@/components/CourseGrid';
import { SectionTitle } from '@/components/SectionTitle';
import type { EnrolledCourse } from '@/lib/types';

interface HomeScreenProps {
  firstname: string;
  courses: EnrolledCourse[];
}

export function HomeScreen({ firstname, courses }: HomeScreenProps) {
  return (
    <>
      <Typography variant="h1" sx={{ mb: 3 }}>Welcome back, {firstname}</Typography>
      
    </>
  );
}
