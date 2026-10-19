import type { Metadata } from 'next';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle } from '@/lib/moodle';
import { Loading } from '@/components/Loading';
import { CatalogueScreen } from '@/components/screens/Catalogue';

export const metadata: Metadata = { title: 'Course catalogue' };

export default function CataloguePage() {
  return (
    <Suspense fallback={<Loading label="Loading the catalogue…" />}>
      <Catalogue />
    </Suspense>
  );
}

async function Catalogue() {
  const session = await verifySession();
  // Two independent requests, so run them at the same time.
  const [categories, courses] = await Promise.all([
    moodle.categories(session.token),
    moodle.allCourses(session.token),
  ]);

  const grouped = categories
    .filter((c) => c.parent === 0)
    .sort((a, b) => a.sortorder - b.sortorder)
    .map((category) => ({ category, courses: courses.filter((course) => course.categoryid === category.id) }));

  return <CatalogueScreen categories={grouped} />;
}
