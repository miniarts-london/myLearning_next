import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { activityHref } from '@/lib/links';
import { SafeHtml } from '@/components/SafeHtml';
import { Loading } from '@/components/Loading';
import type { CourseModule } from '@/lib/types';
import { toggleCompletion } from '../../actions';

type Props = { params: Promise<{ id: string; cmid: string }> };

export const metadata: Metadata = { title: 'Activity' };

export default function ActivityPage({ params }: Props) {
  return (
    <Suspense fallback={<Loading label="Loading the activity…" />}>
      <ActivityContent params={params} />
    </Suspense>
  );
}

// Moodle refuses activities the user can't see. Treat that as "not found" rather than crashing.
function orNull<T>(promise: Promise<T>): Promise<T | null> {
  return promise.catch((e: unknown) => {
    if (e instanceof MoodleError) {
      return null;
    }
    throw e;
  });
}

async function ActivityContent({ params }: Props) {
  const { id, cmid: cmidParam } = await params;
  const courseid = Number(id);
  const cmid = Number(cmidParam);
  if (!Number.isInteger(courseid) || !Number.isInteger(cmid)) {
    notFound();
  }
  const session = await verifySession();

  const [course, sections] = await Promise.all([
    moodle.course(session.token, courseid),
    orNull(moodle.courseContents(session.token, courseid)),
  ]);
  // Activities with a link, in course order. Labels have no page of their own, so they're left out.
  const activities = (sections ?? [])
    .filter((s) => s.uservisible !== false)
    .flatMap((s) => s.modules)
    .filter((m) => m.uservisible && m.url);
  const index = activities.findIndex((m) => m.id === cmid);
  const m = activities[index];
  if (!course || !m) {
    notFound();
  }
  const prev = activities[index - 1];
  const next = activities[index + 1];

  return (
    <>
      <p className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link> / <Link href={`/courses/${courseid}`}>{course.fullname}</Link>
      </p>
      <h1>{m.name}</h1>

      <article className="activity-body">
        <ActivityBody module={m} courseid={courseid} token={session.token} />
      </article>

      <Completion module={m} courseid={courseid} />

      <nav className="pager" aria-label="Activities in this course">
        {prev ? (
          <Link href={activityHref(courseid, prev.id)} className="pager__link" rel="prev">
            <span className="pager__label">Previous</span> {prev.name}
          </Link>
        ) : <span />}
        <Link href={`/courses/${courseid}`} className="pager__link pager__link--course">Back to course</Link>
        {next ? (
          <Link href={activityHref(courseid, next.id)} className="pager__link pager__link--next" rel="next">
            <span className="pager__label">Next</span> {next.name}
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}

async function ActivityBody({ module: m, courseid, token }: { module: CourseModule; courseid: number; token: string }) {
  switch (m.modname) {
    case 'page': {
      const page = await orNull(moodle.page(token, courseid, m.id));
      if (page) {
        return (
          <>
            <SafeHtml html={page.intro} className="summary" />
            <SafeHtml html={page.content} className="prose" />
          </>
        );
      }
      break;
    }
    case 'url': {
      const link = await orNull(moodle.url(token, courseid, m.id));
      if (link) {
        return (
          <>
            <SafeHtml html={link.intro} className="summary" />
            <p>
              <a href={link.externalurl} target="_blank" rel="noopener noreferrer" className="btn">
                Open {new URL(link.externalurl).hostname}<span className="visually-hidden"> (opens in a new tab)</span> ↗
              </a>
            </p>
          </>
        );
      }
      break;
    }
    case 'assign': {
      const assignment = await orNull(moodle.assignment(token, courseid, m.id));
      if (assignment) {
        return (
          <>
            {assignment.duedate > 0 && (
              <p className="due">
                Due{' '}
                <time dateTime={new Date(assignment.duedate * 1000).toISOString()}>
                  {new Date(assignment.duedate * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' })}
                </time>
              </p>
            )}
            <SafeHtml html={assignment.intro} className="prose" />
            <p className="note">
              Submitting work isn&apos;t available in this app yet.{' '}
              <MoodleLink href={m.url!}>Submit in Moodle</MoodleLink>
            </p>
          </>
        );
      }
      break;
    }
  }
  // Any other activity type (quiz, forum…) isn't built in this app yet.
  return (
    <p className="note">
      This type of activity ({m.modname}) isn&apos;t available in this app yet.{' '}
      <MoodleLink href={m.url ?? moodleUrl(`/course/view.php?id=${courseid}`)}>Open it in Moodle</MoodleLink>
    </p>
  );
}

// The few links that still go to Moodle open in a new tab, so this app stays open behind them.
function MoodleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span> ↗
    </a>
  );
}

function Completion({ module: m, courseid }: { module: CourseModule; courseid: number }) {
  const completion = m.completiondata;
  if (!completion?.hascompletion) {
    return null;
  }
  const complete = completion.state > 0;
  if (completion.isautomatic) {
    return <p><span className={`badge${complete ? ' badge--done' : ''}`}>{complete ? 'Done' : 'To do'}</span></p>;
  }
  return (
    <form action={toggleCompletion} className="completion">
      <input type="hidden" name="courseid" value={courseid} />
      <input type="hidden" name="cmid" value={m.id} />
      <input type="hidden" name="completed" value={complete ? '0' : '1'} />
      <button type="submit" className={`btn ${complete ? 'btn--done' : ''}`}
        aria-label={complete ? `${m.name}: done. Mark as not done` : `Mark ${m.name} as done`}>
        {complete ? '✓ Done' : 'Mark as done'}
      </button>
    </form>
  );
}
