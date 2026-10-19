import { CourseCard } from '@/components/CourseCard';
import { SafeHtml } from '@/components/SafeHtml';
import type { Category, Course } from '@/lib/types';

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
      <h1>Course catalogue</h1>
      {categories.map(({ category, courses }) => (
        <section key={category.id} aria-labelledby={`cat-${category.id}`} className="category">
          <h2 id={`cat-${category.id}`} className="section-title">{category.name}</h2>
          <SafeHtml html={category.description} className="category__description" />
          {courses.length === 0 ? (
            <p className="empty">No courses in this category yet.</p>
          ) : (
            <ul className="grid" role="list">
              {courses.map((course) => (
                <li key={course.id}>
                  <CourseCard id={course.id} name={course.fullname} image={course.courseimage} />
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}
