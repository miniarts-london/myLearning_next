import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { SafeHtml } from '@/components/SafeHtml';
import { CompletionButton } from '@/components/screens/courses/CompletionButton';
import { activityHref, submissionsHref } from '@/lib/links';
import { AssignmentSubmission } from '@/components/screens/courses/AssignmentSubmission';
import type { AssignmentView } from '@/lib/assignment';
import type { Course, CourseModule } from '@/lib/types';
import styles from '@/css/Activity.module.css';

// What the page fetched for this activity, depending on its type.
export type ActivityDetail =
  | { kind: 'page'; intro: string; content: string }
  | { kind: 'url'; intro: string; externalurl: string }
  | { kind: 'assign'; intro: string; duedate: number; moodleUrl: string; submission: AssignmentView | null; forLearner: boolean }
  | { kind: 'other'; modname: string; moodleUrl: string }; // Not built in this app yet

interface ActivityScreenProps {
  course: Course;
  activity: CourseModule;
  detail: ActivityDetail;
  prev?: CourseModule;
  next?: CourseModule;
  forLearner?: boolean; // false for the course's teachers: no "Mark as done" or "Your submission"
}

export function ActivityScreen({ course, activity, detail, prev, next, forLearner = true }: ActivityScreenProps) {
  return (
    <>
      {/* Shown under the course name and tabs (the shared course layout), so it's the second-level heading. */}
      <Typography variant="h4" component="h2" className={styles.title}>{activity.name}</Typography>

      <Box component="article" className={styles.article}>
        <ActivityBody detail={detail} courseid={course.id} cmid={activity.id} />
      </Box>

      {forLearner && (
        <Box className={styles.completion}>
          <CompletionButton module={activity} courseid={course.id} />
        </Box>
      )}

      <Divider className={styles.divider} />
      <Box component="nav" aria-label="Activities in this course" className={styles.pager}>
        {prev ? (
          <PagerLink href={activityHref(course.id, prev.id)} rel="prev" label="Previous" name={prev.name} />
        ) : <span />}
        <Link href={`/courses/${course.id}`} className={styles.back}>
          Back to course
        </Link>
        {next ? (
          <PagerLink href={activityHref(course.id, next.id)} rel="next" label="Next" name={next.name} />
        ) : <span />}
      </Box>
    </>
  );
}

function PagerLink({ href, rel, label, name }: { href: string; rel: 'prev' | 'next'; label: string; name: string }) {
  const isNext = rel === 'next';
  return (
    <Button href={href} rel={rel} color="secondary"
      startIcon={isNext ? undefined : <ArrowBackIcon />} endIcon={isNext ? <ArrowForwardIcon /> : undefined}
      className={`${styles.pagerLink} ${isNext ? styles.next : styles.prev}`}>
      <Box component="span" className={styles.pagerText}>
        <Typography component="span" variant="overline" className={styles.pagerLabel}>{label}</Typography>
        <Typography component="span" className={styles.pagerName}>{name}</Typography>
      </Box>
    </Button>
  );
}

function ActivityBody({ detail, courseid, cmid }: { detail: ActivityDetail; courseid: number; cmid: number }) {
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
          <Button component="a" href={detail.externalurl} target="_blank" rel="noopener noreferrer"
            variant="contained" color="primary" endIcon={<OpenInNewIcon />}>
            Open {new URL(detail.externalurl).hostname}<span className="visually-hidden"> (opens in a new tab)</span>
          </Button>
        </>
      );
    case 'assign':
      return (
        <>
          {detail.duedate > 0 && (
            <Alert severity="warning" icon={false} className={styles.due}>
              Due{' '}
              <time dateTime={new Date(detail.duedate * 1000).toISOString()}>
                {new Date(detail.duedate * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' })}
              </time>
            </Alert>
          )}
          <SafeHtml html={detail.intro} className="prose" />
          {!detail.forLearner ? (
            // Teachers: the Submissions page here, or Moodle's own grader (for rubrics, scales…).
            <div className={styles.teacherActions}>
              <Button href={submissionsHref(courseid, cmid)} variant="contained" color="primary">
                Submissions
              </Button>
              <Button component="a" href={gradingUrl(detail.moodleUrl)} target="_blank" rel="noopener noreferrer"
                color="secondary" endIcon={<OpenInNewIcon />}>
                View and grade submissions in Moodle<span className="visually-hidden"> (opens in a new tab)</span>
              </Button>
            </div>
          ) : detail.submission ? (
            <AssignmentSubmission view={detail.submission} courseid={courseid} moodleUrl={detail.moodleUrl}
              submittedText={<SafeHtml html={detail.submission.html} className="prose" />}
              feedback={detail.submission.feedbackHtml && <SafeHtml html={detail.submission.feedbackHtml} className="prose" />} />
          ) : (
            <Alert severity="warning" className={styles.alertGap} action={<MoodleButton href={detail.moodleUrl}>Open in Moodle</MoodleButton>}>
              Your submission couldn&apos;t be loaded.
            </Alert>
          )}
        </>
      );
    case 'other':
      return (
        <Alert severity="info" action={<MoodleButton href={detail.moodleUrl}>Open in Moodle</MoodleButton>}>
          This type of activity ({detail.modname}) isn&apos;t available in this app yet.
        </Alert>
      );
  }
}

// The few links that still go to Moodle open in a new tab, so this app stays open behind them.
// Moodle's grading table for an assignment: its page (mod/assign/view.php?id=…) with action=grading.
function gradingUrl(assignmentUrl: string): string {
  try {
    const url = new URL(assignmentUrl);
    url.searchParams.set('action', 'grading');
    return url.toString();
  } catch {
    return assignmentUrl;
  }
}

function MoodleButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" color="inherit" size="small" endIcon={<OpenInNewIcon />}>
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span>
    </Button>
  );
}
