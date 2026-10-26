'use client';

import { usePathname } from 'next/navigation';
import Link from '@mui/material/Link';
import styles from '@/css/CourseTabs.module.css';

const TABS = [
  { label: 'Syllabus', path: '' },
  { label: 'Students', path: '/learners' },
  { label: 'Assignments', path: '/submissions' },
];

// Syllabus / Students / Assignments. Each tab is its own page (a link, marked with aria-current),
// so the address, the back button and bookmarks all work. Lives in the shared layout, so it reads
// the current page from the address.
export function CourseTabs({ courseid }: { courseid: number }) {
  const pathname = usePathname();
  const base = `/courses/${courseid}`;
  return (
    <nav aria-label="Course pages" className={styles.tabs}>
      <ul>
        {TABS.map((t) => {
          // Syllabus stays selected while an activity from it is open (aria-current="true": in this
          // section, but not this exact page).
          const exact = pathname === base + t.path;
          const within = t.path === '' && pathname.startsWith(`${base}/activities/`);
          const current = exact || within;
          return (
            <li key={t.label}>
              <Link href={base + t.path} underline="none" aria-current={exact ? 'page' : within ? 'true' : undefined}
                className={`${styles.tab} ${current ? styles.current : ''}`}>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
