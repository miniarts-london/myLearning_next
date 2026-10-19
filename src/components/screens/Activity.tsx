import Link from 'next/link';
import Button from '@mui/material/Button';
import { SafeHtml } from '@/components/SafeHtml';
import { CompletionButton } from '@/components/CompletionButton';
import { activityHref } from '@/lib/links';
import type { Course, CourseModule } from '@/lib/types';

// What the page fetched for this activity, depending on its type.
export type ActivityDetail =
  | { kind: 'page'; intro: string; content: string }
  | { kind: 'url'; intro: string; externalurl: string }
  | { kind: 'assign'; intro: string; duedate: number; moodleUrl: string }
  | { kind: 'other'; modname: string; moodleUrl: string }; // Not built in this app yet

interface ActivityScreenProps {
  course: Course;
  activity: CourseModule;
  detail: ActivityDetail;
  prev?: CourseModule;
  next?: CourseModule;
}

export function ActivityScreen({ course, activity, detail, prev, next }: ActivityScreenProps) {
  return (
    <>
      <p className="breadcrumb">
        <Link href="/dashboard">Dashboard</Link> / <Link href={`/courses/${course.id}`}>{course.fullname}</Link>
      </p>
      <h1>{activity.name}</h1>

      <article className="activity-body">
        <ActivityBody detail={detail} />
      </article>

      <div className="completion">
        <CompletionButton module={activity} courseid={course.id} />
      </div>

      <nav className="pager" aria-label="Activities in this course">
        {prev ? (
          <Link href={activityHref(course.id, prev.id)} className="pager__link" rel="prev">
            <span className="pager__label">Previous</span> {prev.name}
          </Link>
        ) : <span />}
        <Link href={`/courses/${course.id}`} className="pager__link pager__link--course">Back to course</Link>
        {next ? (
          <Link href={activityHref(course.id, next.id)} className="pager__link pager__link--next" rel="next">
            <span className="pager__label">Next</span> {next.name}
          </Link>
        ) : <span />}
      </nav>
    </>
  );
}

function ActivityBody({ detail }: { detail: ActivityDetail }) {
  switch (detail.kind) {
    case 'page':
      return (
        <>
          <SafeHtml html={detail.intro} className="summary" />
          <SafeHtml html={detail.content} className="prose" />
        </>
      );
    case 'url':
      return (
        <>
          <SafeHtml html={detail.intro} className="summary" />
          <p>
            <Button href={detail.externalurl} target="_blank" rel="noopener noreferrer" variant="contained" color="primary">
              Open {new URL(detail.externalurl).hostname}<span className="visually-hidden"> (opens in a new tab)</span> ↗
            </Button>
          </p>
        </>
      );
    case 'assign':
      return (
        <>
          {detail.duedate > 0 && (
            <p className="due">
              Due{' '}
              <time dateTime={new Date(detail.duedate * 1000).toISOString()}>
                {new Date(detail.duedate * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' })}
              </time>
            </p>
          )}
          <SafeHtml html={detail.intro} className="prose" />
          <p className="note">
            Submitting work isn&apos;t available in this app yet.{' '}
            <MoodleLink href={detail.moodleUrl}>Submit in Moodle</MoodleLink>
          </p>
        </>
      );
    case 'other':
      return (
        <p className="note">
          This type of activity ({detail.modname}) isn&apos;t available in this app yet.{' '}
          <MoodleLink href={detail.moodleUrl}>Open it in Moodle</MoodleLink>
        </p>
      );
  }
}

// The few links that still go to Moodle open in a new tab, so this app stays open behind them.
function MoodleLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span> ↗
    </a>
  );
}
