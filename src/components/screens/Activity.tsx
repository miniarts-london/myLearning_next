import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { SafeHtml } from '@/components/SafeHtml';
import { CompletionButton } from '@/components/CompletionButton';
import { activityHref } from '@/lib/links';
import { AssignmentSubmission } from '@/components/AssignmentSubmission';
import type { AssignmentView } from '@/lib/assignment';
import type { Course, CourseModule } from '@/lib/types';

// What the page fetched for this activity, depending on its type.
export type ActivityDetail =
  | { kind: 'page'; intro: string; content: string }
  | { kind: 'url'; intro: string; externalurl: string }
  | { kind: 'assign'; intro: string; duedate: number; moodleUrl: string; submission: AssignmentView | null }
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
      <Breadcrumbs sx={{ mb: 1, fontSize: '.875rem' }}>
        <Link href="/dashboard">Dashboard</Link>
        <Link href={`/courses/${course.id}`}>{course.fullname}</Link>
      </Breadcrumbs>
      <Typography variant="h1" sx={{ mb: 3 }}>{activity.name}</Typography>

      <Box component="article" sx={{ maxWidth: '45rem', my: 3 }}>
        <ActivityBody detail={detail} courseid={course.id} />
      </Box>

      <Box sx={{ my: 3, '&:empty': { display: 'none' } }}>
        <CompletionButton module={activity} courseid={course.id} />
      </Box>

      <Divider sx={{ mt: 4, mb: 2.5 }} />
      <Box component="nav" aria-label="Activities in this course"
        sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr auto 1fr' }, gap: 2, alignItems: 'start' }}>
        {prev ? (
          <PagerLink href={activityHref(course.id, prev.id)} rel="prev" label="Previous" name={prev.name} />
        ) : <span />}
        <Link href={`/courses/${course.id}`}
          sx={{ alignSelf: 'center', justifySelf: 'center', gridRow: { xs: 2, sm: 'auto' }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
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
      sx={{ justifySelf: isNext ? 'end' : 'start', textTransform: 'none', textAlign: isNext ? 'right' : 'left', px: 1 }}>
      <Box component="span" sx={{ display: 'grid' }}>
        <Typography component="span" variant="overline" sx={{ color: 'text.secondary' }}>{label}</Typography>
        <Typography component="span" sx={{ fontWeight: 600 }}>{name}</Typography>
      </Box>
    </Button>
  );
}

function ActivityBody({ detail, courseid }: { detail: ActivityDetail; courseid: number }) {
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
            <Alert severity="warning" icon={false} sx={{ mb: 2, fontWeight: 600 }}>
              Due{' '}
              <time dateTime={new Date(detail.duedate * 1000).toISOString()}>
                {new Date(detail.duedate * 1000).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/London' })}
              </time>
            </Alert>
          )}
          <SafeHtml html={detail.intro} className="prose" />
          {detail.submission ? (
            <AssignmentSubmission view={detail.submission} courseid={courseid} moodleUrl={detail.moodleUrl}
              submittedText={<SafeHtml html={detail.submission.html} className="prose" />}
              feedback={detail.submission.feedbackHtml && <SafeHtml html={detail.submission.feedbackHtml} className="prose" />} />
          ) : (
            <Alert severity="warning" sx={{ mt: 2 }} action={<MoodleButton href={detail.moodleUrl}>Open in Moodle</MoodleButton>}>
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
function MoodleButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button component="a" href={href} target="_blank" rel="noopener noreferrer" color="inherit" size="small" endIcon={<OpenInNewIcon />}>
      {children}<span className="visually-hidden"> (opens Moodle in a new tab)</span>
    </Button>
  );
}
