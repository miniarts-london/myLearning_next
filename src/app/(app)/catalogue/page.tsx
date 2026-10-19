import type { Metadata } from 'next';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { CourseCard } from '@/components/CourseCard';
import { SafeHtml } from '@/components/SafeHtml';
import { Loading } from '@/components/Loading';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Course catalogue' };

export default function CataloguePage() {
  return (
    <>
      <h1>Course catalogue</h1>
      <Suspense fallback={<Loading label="Loading the catalogue…" />}>
        <Catalogue />
      </Suspense>
    </>
  );
}

async function Catalogue() {
  const session = await verifySession();
  // Two independent requests, so run them at the same time.
  const [categories, courses] = await Promise.all([
    moodle.categories(session.token),
    moodle.allCourses(session.token),
  ]);

  const topLevel = categories.filter((c) => c.parent === 0).sort((a, b) => a.sortorder - b.sortorder);

  return (
    <>
      {topLevel.map((category) => {
        const inCategory = courses.filter((course) => course.categoryid === category.id);
        return (
          <section key={category.id} aria-labelledby={`cat-${category.id}`} className="category">
            <h2 id={`cat-${category.id}`} className="section-title">{category.name}</h2>
            <SafeHtml html={category.description} className="category__description" />
            {inCategory.length === 0 ? (
              <p className="empty">No courses in this category yet.</p>
            ) : (
              <ul className="grid" role="list">
                {inCategory.map((course) => (
                  <li key={course.id}>
                    <CourseCard id={course.id} name={course.fullname} image={course.courseimage} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
