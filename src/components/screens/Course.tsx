import Link from 'next/link';
import { SafeHtml } from '@/components/SafeHtml';
import { ProgressBar } from '@/components/ProgressBar';
import { CompletionButton } from '@/components/CompletionButton';
import { activityHref } from '@/lib/links';
import type { Course, CourseModule, CourseSection } from '@/lib/types';

interface CourseScreenProps {
  course: Course;
  sections: CourseSection[] | null; // null when the user isn't enrolled
  progress: number | null;          // 0–100, or null when nothing is tracked
  moodleCourseUrl: string;          // Where to enrol, in Moodle
}

export function CourseScreen({ course, sections, progress, moodleCourseUrl }: CourseScreenProps) {
  return (
    <>
      <p className="breadcrumb"><Link href="/dashboard">Dashboard</Link> / {course.categoryname}</p>
      <h1>{course.fullname}</h1>
      <SafeHtml html={course.summary} className="summary" />

      {sections === null ? (
        <p className="empty">
          You aren&apos;t enrolled in this course.{' '}
          <a href={moodleCourseUrl} target="_blank" rel="noopener noreferrer">
            Open it in Moodle<span className="visually-hidden"> (opens in a new tab)</span> ↗
          </a>{' '}to enrol.
        </p>
      ) : (
        <>
          {progress !== null && <ProgressBar value={progress} label="Course progress" />}
          {sections.map((section) => (
            <section key={section.id} className="section" aria-labelledby={`section-${section.id}`}>
              <h2 id={`section-${section.id}`} className="section-title">{section.name}</h2>
              <SafeHtml html={section.summary} className="summary" />
              <ul className="activities" role="list">
                {section.modules.map((m) => (
                  <Activity key={m.id} module={m} courseid={course.id} />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}

function Activity({ module: m, courseid }: { module: CourseModule; courseid: number }) {
  const complete = (m.completiondata?.state ?? 0) > 0;
  return (
    <li className={`activity${complete ? ' activity--done' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Moodle's activity icon. */}
      <img className="activity__icon" src={m.modicon} alt="" width={24} height={24} />
      <div className="activity__main">
        {m.url ? (
          // Activities open inside this app; types it can't show yet offer a link to Moodle from there.
          <Link href={activityHref(courseid, m.id)} className="activity__name">{m.name}</Link>
        ) : m.modname === 'label' && m.description ? (
          <SafeHtml html={m.description} className="activity__label" />
        ) : (
          <span className="activity__name">{m.name}</span>
        )}
        {m.modname !== 'label' && <span className="activity__type">{m.modname}</span>}
      </div>
      <CompletionButton module={m} courseid={courseid} size="small" />
    </li>
  );
}
