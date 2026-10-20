import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { verifySession } from '@/lib/dal';
import { moodle, moodleUrl, MoodleError } from '@/lib/moodle';
import { Loading } from '@/components/Loading';
import { ActivityScreen, type ActivityDetail } from '@/components/screens/Activity';
import type { CourseModule } from '@/lib/types';
import { toAssignmentView } from '@/lib/assignment';

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
    .flatMap((s) => s.modules)
    .filter((m) => m.url);
  const index = activities.findIndex((m) => m.id === cmid);
  const activity = activities[index];
  if (!course || !activity) {
    notFound();
  }

  const detail = await fetchDetail(session.token, courseid, activity);

  return (
    <ActivityScreen
      course={course}
      activity={activity}
      detail={detail}
      prev={activities[index - 1]}
      next={activities[index + 1]}
    />
  );
}

// Each activity type has its own Moodle web service. Types this app doesn't show yet link to Moodle.
async function fetchDetail(token: string, courseid: number, m: CourseModule): Promise<ActivityDetail> {
  const inMoodle = m.url ?? moodleUrl(`/course/view.php?id=${courseid}`);
  switch (m.modname) {
    case 'page': {
      const page = await orNull(moodle.page(token, courseid, m.id));
      if (page) {
        return { kind: 'page', intro: page.intro, content: page.content };
      }
      break;
    }
    case 'url': {
      const link = await orNull(moodle.url(token, courseid, m.id));
      if (link) {
        return { kind: 'url', intro: link.intro, externalurl: link.externalurl };
      }
      break;
    }
    case 'assign': {
      const assignment = await orNull(moodle.assignment(token, courseid, m.id));
      if (assignment) {
        const status = await orNull(moodle.submissionStatus(token, assignment.id));
        return {
          kind: 'assign',
          intro: assignment.intro,
          duedate: assignment.duedate,
          moodleUrl: inMoodle,
          submission: status ? toAssignmentView(assignment, status) : null,
        };
      }
      break;
    }
  }
  return { kind: 'other', modname: m.modname, moodleUrl: inMoodle };
}
