import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import { CourseCard } from '@/components/CourseCard';
import { CourseGrid } from '@/components/CourseGrid';
import { ReadMore } from '@/components/ReadMore';
import { SafeHtml } from '@/components/SafeHtml';
import { SectionTitle } from '@/components/SectionTitle';
import type { Category, Course } from '@/lib/types';
import common from '@/css/common.module.css';

export interface CatalogueCategory {
  category: Category;
  courses: Course[];
}

interface CatalogueScreenProps {
  categories: CatalogueCategory[];
}

export function CatalogueScreen({ categories }: CatalogueScreenProps) {
  return (
    <>
      <Typography variant="h1" className={common.pageTitle}>Courses</Typography>
      {categories.map(({ category, courses }) => (
        <section key={category.id} aria-labelledby={`cat-${category.id}`}>
          <SectionTitle id={`cat-${category.id}`}>{category.name}</SectionTitle>
          {category.description?.trim() && (
            <ReadMore label={category.name}>
              <SafeHtml html={category.description} className="summary category__description" />
            </ReadMore>
          )}
          {courses.length === 0 ? (
            <Alert severity="info">No courses in this category yet.</Alert>
          ) : (
            <CourseGrid>
              {courses.map((course) => (
                <li key={course.id}>
                  <CourseCard id={course.id} name={course.fullname} image={course.courseimage} />
                </li>
              ))}
            </CourseGrid>
          )}
        </section>
      ))}
    </>
  );
}
