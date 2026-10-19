import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { SafeHtml } from '@/components/SafeHtml';
import { ProgressBar } from '@/components/ProgressBar';
import type { CourseModule } from '@/lib/types';
import { Suspense } from 'react';
import { Loading } from '@/components/Loading';
import { toggleCompletion } from './actions';
import { activityHref } from '@/lib/links';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: 'Course' };

export default function CoursePage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the course…" />}>
      <CourseContent params={params} />
    </Suspense>
  );
}

async function CourseContent({ params }: Props) {
  const { id } = await params;
  const courseid = Number(id);
  if (!Number.isInteger(courseid)) {
    notFound();
  }
  const session = await verifySession();

  const [course, sections] = await Promise.all([
    moodle.course(session.token, courseid),
    // Moodle refuses the contents of a course the user can't access: show a friendly message instead.
    moodle.courseContents(session.token, courseid).catch((e: unknown) => {
      if (e instanceof MoodleError) {
        return null;
      }
      throw e;
    }),
  ]);
  if (!course) {
    notFound();
  }

  const tracked = (sections ?? []).flatMap((s) => s.modules).filter((m) => m.completiondata?.hascompletion);
  const done = tracked.filter((m) => (m.completiondata?.state ?? 0) > 0).length;

  return (
    <>
      <p className="breadcrumb"><Link href="/dashboard">Dashboard</Link> / {course.categoryname}</p>
      <h1>{course.fullname}</h1>
      <SafeHtml html={course.summary} className="summary" />

      {sections === null ? (
        <p className="empty">
          You aren&apos;t enrolled in this course.{' '}
          <a href={moodleUrl(`/course/view.php?id=${courseid}`)} target="_blank" rel="noopener noreferrer">
            Open it in Moodle<span className="visually-hidden"> (opens in a new tab)</span> ↗
          </a>{' '}to enrol.
        </p>
      ) : (
        <>
          {tracked.length > 0 && (
            <ProgressBar value={(done / tracked.length) * 100} label="Course progress" />
          )}
          {sections
            .filter((s) => s.uservisible !== false && (s.modules.length > 0 || s.summary))
            .map((section) => (
              <section key={section.id} className="section" aria-labelledby={`section-${section.id}`}>
                <h2 id={`section-${section.id}`} className="section-title">{section.name}</h2>
                <SafeHtml html={section.summary} className="summary" />
                <ul className="activities" role="list">
                  {section.modules.filter((m) => m.uservisible).map((m) => (
                    <Activity key={m.id} module={m} courseid={courseid} />
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
  const completion = m.completiondata;
  const complete = (completion?.state ?? 0) > 0;

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

      {completion?.hascompletion && (completion.isautomatic ? (
        <span className={`badge${complete ? ' badge--done' : ''}`}>{complete ? 'Done' : 'To do'}</span>
      ) : (
        <form action={toggleCompletion}>
          <input type="hidden" name="courseid" value={courseid} />
          <input type="hidden" name="cmid" value={m.id} />
          <input type="hidden" name="completed" value={complete ? '0' : '1'} />
          <button type="submit" className={`btn btn--small ${complete ? 'btn--done' : 'btn--outline'}`}
            aria-label={complete ? `${m.name}: done. Mark as not done` : `Mark ${m.name} as done`}>
            {complete ? '✓ Done' : 'Mark as done'}
          </button>
        </form>
      ))}
    </li>
  );
}
